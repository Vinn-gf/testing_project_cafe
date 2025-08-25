# csv_utils.py
from pathlib import Path
import pandas as pd
import csv, re

def robust_read_csv(path: Path):
    """
    Try several encodings/separators; fallback to csv.reader heuristics.
    Returns pandas.DataFrame with string columns (no NaN).
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(path)
    encs = ["utf-8-sig","utf-8","cp1252","latin-1"]
    seps = [None, ",", ";", "\t", "|"]
    best = None; best_score = -1
    for enc in encs:
        for sep in seps:
            try:
                if sep is None:
                    df = pd.read_csv(path, encoding=enc, engine="python", dtype=str, on_bad_lines="warn")
                else:
                    df = pd.read_csv(path, encoding=enc, sep=sep, engine="python", dtype=str, on_bad_lines="warn")
                cols = [c.strip().lower() for c in df.columns.tolist()]
                score = len(df.columns)
                if "label" in cols: score += 10
                if "ulasan" in cols or "review" in cols: score += 5
                if score > best_score:
                    best_score = score; best = (df, enc, sep)
            except Exception:
                continue
    if best is not None:
        df, enc, sep = best
        return df.fillna("").astype(str)

    # fallback: csv.reader with heuristics
    sample = path.read_text(encoding="utf-8", errors="replace")[:8192]
    delims = [",",";","\t","|"]
    best_rows = None; best_delim = None; best_score = -1
    for d in delims:
        try:
            with open(path, "r", encoding="utf-8", errors="replace", newline="") as f:
                reader = csv.reader(f, delimiter=d, quotechar='"')
                rows = list(reader)
            if not rows: continue
            hdr = " ".join(rows[0]).lower()
            score = 0
            if "label" in hdr: score += 10
            if "ulasan" in hdr or "review" in hdr: score += 5
            lens = [len(r) for r in rows if r is not None]
            median_len = sorted(lens)[len(lens)//2] if lens else 0
            score += -abs(median_len - 2)
            score += min(10, len(rows)//100)
            if score > best_score:
                best_score = score; best_rows = rows; best_delim = d
        except Exception:
            continue
    if best_rows is None:
        raise RuntimeError(f"Failed to parse CSV fallback: {path}")

    rows = [r for r in best_rows if any((c or "").strip() for c in r)]
    first_lower = [ (c or "").strip().lower() for c in rows[0] ]
    has_header = any(x in ("label","ulasan","review","comment","pool_idx") for x in first_lower)
    data_rows = rows[1:] if has_header else rows
    normalized = []
    for r in data_rows:
        r = [ (c or "").strip() for c in r ]
        if len(r) == 1:
            cell = r[0]
            m = re.search(r'[,;]\s*(positive|negative|neutral)\s*$', cell, flags=re.I)
            if m:
                label = m.group(1).lower(); ul = cell[:m.start()].strip()
                normalized.append({"ulasan": ul, "label": label})
            else:
                normalized.append({"ulasan": cell, "label": ""})
        elif len(r) == 2:
            if r[1].lower() in ("positive","negative","neutral"):
                normalized.append({"ulasan": r[0], "label": r[1]})
            else:
                normalized.append({"ulasan": r[1], "label": "", "pool_idx": r[0]})
        else:
            label_idx = None
            for i,cell in enumerate(r):
                if (cell or "").lower() in ("positive","negative","neutral"):
                    label_idx=i; break
            if label_idx is None: label_idx = len(r)-1
            pool_idx = None
            if r[0].isdigit():
                pool_idx = r[0]; ul_parts = r[1:label_idx]
            else:
                ul_parts = r[:label_idx]
            ulasan = " ".join([p for p in ul_parts if p])
            label = r[label_idx] if label_idx < len(r) else ""
            d = {"ulasan": ulasan.strip(), "label": label.strip()}
            if pool_idx: d["pool_idx"] = pool_idx
            normalized.append(d)
    import pandas as pd
    df = pd.DataFrame(normalized)
    return df.fillna("").astype(str)

def write_csv_semicolon(path: Path, df):
    """Write CSV with semicolon delimiter and utf-8-sig encoding."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False, sep=';', encoding="utf-8-sig")
