# make_unlabeled_pool.py
from pathlib import Path
import csv
import re

INPUT = Path("data/all_reviews_pool.csv")
LABELED = Path("data/labeled_all.csv")        # optional: if exists, we will exclude labeled texts
OUT = Path("data/unlabeled_pool.csv")

ENCODINGS = ("utf-8-sig", "utf-8", "cp1252", "latin-1")

def read_text_try_encodings(p: Path):
    last_exc = None
    for enc in ENCODINGS:
        try:
            data = p.read_text(encoding=enc)
            return data, enc
        except Exception as e:
            last_exc = e
            continue
    # final fallback
    data = p.read_text(encoding="utf-8", errors="replace")
    return data, "utf-8-replace"

def detect_delimiter_and_header(sample_text: str):
    """
    Try to detect if file uses a delimiter and whether a header with 'ulasan' exists.
    Returns (detected_delim or None, has_header_bool)
    """
    # take first few non-empty lines
    lines = [l for l in sample_text.splitlines() if l.strip()][:20]
    if not lines:
        return None, False
    header = lines[0]
    # if header contains "ulasan" token and a delimiter candidate, we treat as delimited
    for delim in [";", ",", "\t", "|"]:
        if delim in header and re.search(r'\bulasan\b', header, flags=re.I):
            return delim, True
    # heuristics: if many lines contain same delim count -> treat as delimited
    for delim in [";", ",", "\t", "|"]:
        counts = [line.count(delim) for line in lines]
        # if at least 6 lines and most lines have same delim count > 0
        if len(counts) >= 6 and max(counts) > 0 and (counts.count(counts[0]) / len(counts)) > 0.6:
            return delim, False  # delimiter present but maybe no header named 'ulasan'
    return None, False

def parse_delimited(path: Path, delim: str):
    """Parse using csv module safely and return list of ulasan strings (try to find 'ulasan' column)."""
    # Try multiple encodings until one works
    for enc in ENCODINGS:
        try:
            with open(path, "r", encoding=enc, newline="") as f:
                # use csv reader with quotechar handling
                reader = csv.reader(f, delimiter=delim, quotechar='"')
                rows = [r for r in reader]
            if not rows:
                continue
            # normalize header names
            header = [c.strip().lower() for c in rows[0]]
            if "ulasan" in header:
                idx = header.index("ulasan")
                data_rows = rows[1:]
                ulasans = [ (r[idx] if idx < len(r) else "").strip() for r in data_rows ]
                # drop empty ones
                return [u for u in ulasans if u is not None and str(u).strip()!=""]
            else:
                # if no header 'ulasan' but one-column CSV, take first column
                if len(header) == 1:
                    return [r[0].strip() for r in rows if r and r[0].strip()!='']
                # if multiple columns and no ulasan header, attempt to use first column as ulasan
                return [r[0].strip() for r in rows[1:] if r and r[0].strip()!='']
        except Exception:
            continue
    # if all encodings fail, raise
    raise RuntimeError("Failed to parse delimited file with csv reader.")

def parse_raw_lines(path: Path):
    """Read as raw text and take each non-empty physical line as one ulasan.
       If first line equals 'ulasan' (case-insensitive), drop it as header."""
    text, enc = read_text_try_encodings(path)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = text.split("\n")
    # remove BOM from first line if present
    if lines and lines[0].lstrip().lower().startswith("\ufeffulasan"):
        lines[0] = re.sub(r'^\ufeff', '', lines[0])
    # if first non-empty line is the word 'ulasan' treat as header and drop
    first_nonempty = next((l for l in lines if l.strip()), "")
    if re.match(r'^\s*ulasan\s*$', first_nonempty, flags=re.I):
        # drop first occurrence of such header
        found = False
        new_lines = []
        for l in lines:
            if not found and re.match(r'^\s*ulasan\s*$', l, flags=re.I):
                found = True
                continue
            new_lines.append(l)
        lines = new_lines
    # keep non-empty lines and strip trailing/leading spaces, but preserve inner content unchanged
    cleaned = [l.rstrip() for l in lines if l.strip()!='']
    return cleaned

def normalize_text_for_dedupe(s: str):
    # Simple normalizer used to compare vs labeled set
    return re.sub(r'\s+', ' ', s.strip().lower())

def main():
    if not INPUT.exists():
        raise FileNotFoundError(f"Missing input: {INPUT}")
    raw_sample, enc0 = read_text_try_encodings(INPUT)
    delim, has_header = detect_delimiter_and_header(raw_sample)
    print(f"[make_unlabeled] detected delimiter: {delim!r}, header 'ulasan' present: {has_header}, sample-encoding: {enc0}")

    # parse accordingly
    if delim:
        try:
            ulasans = parse_delimited(INPUT, delim)
            print(f"[make_unlabeled] parsed {len(ulasans)} rows using delimiter {delim!r}")
        except Exception as e:
            print("[make_unlabeled] parse_delimited failed — falling back to raw-lines. Error:", e)
            ulasans = parse_raw_lines(INPUT)
            print(f"[make_unlabeled] raw-lines produced {len(ulasans)} rows")
    else:
        ulasans = parse_raw_lines(INPUT)
        print(f"[make_unlabeled] raw-lines produced {len(ulasans)} rows")

    # if labeled file exists, remove labeled items by normalized comparison
    if LABELED.exists():
        # read labeled similarly robustly: try semicolon, comma, raw lines
        labeled = []
        # attempt delimited parsing for labeled
        try:
            lbl_delim, _ = detect_delimiter_and_header(read_text_try_encodings(LABELED)[0])
            if lbl_delim:
                labeled = parse_delimited(LABELED, lbl_delim)
            else:
                labeled = parse_raw_lines(LABELED)
        except Exception:
            labeled = parse_raw_lines(LABELED)
        lab_set = set(normalize_text_for_dedupe(x) for x in labeled if x and x.strip())
        before = len(ulasans)
        ulasans = [u for u in ulasans if normalize_text_for_dedupe(u) not in lab_set]
        after = len(ulasans)
        print(f"[make_unlabeled] removed {before-after} items that were already labeled; remaining {after}")

    # create output directory
    OUT.parent.mkdir(parents=True, exist_ok=True)

    # write semicolon-separated CSV with pool_idx
    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=';', quotechar='"', quoting=csv.QUOTE_MINIMAL)
        w.writerow(["pool_idx", "ulasan"])
        for idx, u in enumerate(ulasans):
            # keep text as-is (do not remove characters)
            w.writerow([idx, u])

    print(f"[make_unlabeled] wrote {OUT} rows={len(ulasans)} (sep=';')")

if __name__ == "__main__":
    main()
