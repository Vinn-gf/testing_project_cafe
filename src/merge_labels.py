# merge_labels.py
"""
Robust merge script for annotated batch -> master labeled_all.csv

Expect:
 - New annotated file: data/to_label_round_labeled.csv (may be messy)
 - Master file: data/labeled_all.csv (may or may not exist)
Output:
 - Overwrites data/labeled_all.csv with merged, deduplicated master (columns: ulasan;label)
"""

from pathlib import Path
import re
import csv
import pandas as pd
from typing import Tuple, List, Dict

# import your project's normalize_text function
from preprocessing import normalize_text

NEW = Path("data/to_label_round_labeled.csv")
MASTER = Path("data/labeled_all.csv")
OUT = MASTER

# encodings and separators to try
ENCODINGS = ["utf-8-sig", "utf-8", "cp1252", "latin-1"]
SEPARATORS = [None, ",", ";", "\t", "|"]

VALID_LABELS = {
    "positive": "positive",
    "pos": "positive",
    "positif": "positive",
    "neg": "negative",
    "negative": "negative",
    "negatif": "negative",
    "neutral": "neutral",
    "netral": "neutral",
    "neu": "neutral",
    "n": "neutral",
    "0": "neutral"
}

def map_label(raw: str) -> str:
    if raw is None:
        return ""
    s = str(raw).strip().lower()
    # remove surrounding quotes
    s = re.sub(r'^["\']+|["\']+$', '', s).strip()
    # if label contains extra tokens, keep only first token that maps
    parts = re.split(r'[\s,;/]+', s)
    for p in parts:
        if p in VALID_LABELS:
            return VALID_LABELS[p]
    # try direct match
    if s in VALID_LABELS:
        return VALID_LABELS[s]
    # if looks like 'positive' inside (contains word)
    for key in VALID_LABELS:
        if key in s:
            return VALID_LABELS[key]
    return ""  # unknown / empty

def try_pandas_read(path: Path) -> Tuple[pd.DataFrame, str, str]:
    """Attempt to read file with pandas using multiple encodings/separators.
       Return (df, encoding_used, sep_used) for the best candidate or raise."""
    best = None
    best_score = -1
    sample = path.read_text(encoding="utf-8", errors="replace")[:8192]
    for enc in ENCODINGS:
        for sep in SEPARATORS:
            try:
                if sep is None:
                    df = pd.read_csv(path, encoding=enc, engine="python", dtype=str, on_bad_lines="warn")
                else:
                    df = pd.read_csv(path, encoding=enc, sep=sep, engine="python", dtype=str, on_bad_lines="warn")
                # scoring heuristic: prefer rows > 0 and presence of label/ulasan-like columns
                cols = [c.strip().lower() for c in df.columns.tolist()]
                score = 0
                if len(df) > 0:
                    score += min(10, len(df)//10)
                if "label" in cols:
                    score += 30
                if "ulasan" in cols or "review" in cols or "comment" in cols:
                    score += 20
                # prefer 2-column-ish tables
                score += max(0, 10 - abs(len(cols)-2))
                if score > best_score:
                    best_score = score
                    best = (df, enc, sep)
            except Exception:
                continue
    if best is None:
        raise RuntimeError("pandas attempts failed to read the file")
    df, enc, sep = best
    return df, enc, sep

def fallback_csv_reader(path: Path) -> pd.DataFrame:
    """Fallback parser using csv.reader. Returns DataFrame with columns inferred."""
    text = path.read_text(encoding="utf-8", errors="replace")
    # try delimiters and choose best by heuristic
    candidates = []
    for delim in [",", ";", "\t", "|"]:
        try:
            rows = list(csv.reader(text.splitlines(), delimiter=delim, quotechar='"'))
            if not rows:
                continue
            header = rows[0]
            hdrtext = " ".join([str(c).lower() for c in header])
            score = 0
            if "label" in hdrtext: score += 20
            if "ulasan" in hdrtext or "review" in hdrtext or "comment" in hdrtext: score += 10
            lens = [len(r) for r in rows]
            median_len = sorted(lens)[len(lens)//2] if lens else 0
            score += -abs(median_len - 2)
            score += min(10, len(rows)//100)
            candidates.append((score, delim, rows))
        except Exception:
            continue
    if not candidates:
        raise RuntimeError("csv.reader fallback failed to parse")
    candidates.sort(reverse=True, key=lambda x: x[0])
    best_rows = candidates[0][2]
    # now normalize best_rows to list of dicts
    rows = [r for r in best_rows if any((c or "").strip() for c in r)]
    # header detection
    first = rows[0]
    first_lower = [ (c or "").strip().lower() for c in first ]
    has_header = any(x in ("label","ulasan","review","comment","pool_idx") for x in first_lower)
    data_rows = rows[1:] if has_header else rows
    normalized = []
    for r in data_rows:
        r = [ (c or "").strip() for c in r ]
        if len(r) == 1:
            cell = r[0]
            # try split by last semicolon/comma if it contains label token
            if ";" in cell and re.search(r";\s*(positive|negative|neutral|pos|neg|neu|positif|negatif)\b", cell, flags=re.I):
                parts = re.split(r';\s*', cell)
                ul = ";".join(parts[:-1]).strip()
                lab = parts[-1].strip()
                normalized.append({"ulasan": ul, "label": lab})
            elif "," in cell and re.search(r",\s*(positive|negative|neutral|pos|neg|neu|positif|negatif)\b", cell, flags=re.I):
                parts = re.split(r',\s*', cell)
                ul = ",".join(parts[:-1]).strip()
                lab = parts[-1].strip()
                normalized.append({"ulasan": ul, "label": lab})
            else:
                normalized.append({"ulasan": cell, "label": ""})
        elif len(r) == 2:
            # decide which is label
            if r[1].lower() in ("positive","negative","neutral","pos","neg","neu","positif","negatif"):
                normalized.append({"ulasan": r[0], "label": r[1]})
            elif r[0].lower() in ("positive","negative","neutral","pos","neg","neu","positif","negatif"):
                normalized.append({"ulasan": r[1], "label": r[0]})
            else:
                # ambiguous: assume (pool_idx, ulasan)
                if r[0].isdigit():
                    normalized.append({"pool_idx": r[0], "ulasan": r[1], "label": ""})
                else:
                    normalized.append({"ulasan": r[0], "label": r[1]})
        else:
            # more than 2 columns: find label index if present
            label_idx = None
            for i,cell in enumerate(r):
                if (cell or "").lower() in ("positive","negative","neutral","pos","neg","neu","positif","negatif"):
                    label_idx = i
                    break
            if label_idx is None:
                # assume last is label candidate
                label_idx = len(r)-1
            pool_idx = None
            if r[0].isdigit():
                pool_idx = r[0]
                ul_parts = r[1:label_idx]
            else:
                ul_parts = r[:label_idx]
            ulasan = " ".join([p for p in ul_parts if p])
            label = r[label_idx] if label_idx < len(r) else ""
            d = {"ulasan": ulasan.strip(), "label": label.strip()}
            if pool_idx:
                d["pool_idx"] = pool_idx
            normalized.append(d)
    return pd.DataFrame(normalized)

def read_new_robust(path: Path) -> pd.DataFrame:
    # prefer pandas attempt
    try:
        df, enc, sep = try_pandas_read(path)
        # ensure columns standardized
        cols_map = {c.strip().lower(): c for c in df.columns.tolist()}
        if "ulasan" in cols_map:
            df = df.rename(columns={cols_map["ulasan"]: "ulasan"})
        elif "review" in cols_map:
            df = df.rename(columns={cols_map["review"]: "ulasan"})
        if "label" in cols_map:
            df = df.rename(columns={cols_map["label"]: "label"})
        # if df has only one column, treat as ulasan
        if "ulasan" not in df.columns and len(df.columns)==1:
            df.columns = ["ulasan"]
        # if no label column and at least 2 columns, assume last column is label
        if "label" not in df.columns and len(df.columns)>=2:
            df = df.rename(columns={df.columns[-1]: "label"})
        df = df.fillna("").astype(str)
        # If file is weird but pandas read it, still convert to canonical two-column
        if "label" not in df.columns:
            # try to parse rows heuristically (join first cell possibly containing ;label)
            parsed = fallback_csv_reader(path)
            return parsed
        # keep minimal columns
        cols = [c for c in ["pool_idx","ulasan","label"] if c in df.columns]
        if "pool_idx" in df.columns:
            return df[cols].copy()
        else:
            return df[["ulasan","label"]].copy()
    except Exception:
        # fallback
        return fallback_csv_reader(path)

def read_master_robust(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame(columns=["ulasan","label"])
    # reuse read_new_robust for master too
    try:
        df = read_new_robust(path)
        # ensure at least columns ulasan,label exist (or create label empty)
        if "ulasan" not in df.columns:
            if len(df.columns) == 1:
                df.columns = ["ulasan"]
            else:
                # try first/last
                df = df.iloc[:, :2]
                df.columns = ["ulasan","label"]
        if "label" not in df.columns:
            df["label"] = ""
        df = df[["ulasan","label"]].fillna("").astype(str)
        return df
    except Exception:
        return pd.DataFrame(columns=["ulasan","label"])

def clean_new_df(df: pd.DataFrame) -> pd.DataFrame:
    # lower/strip label and map variants
    if "label" not in df.columns:
        df["label"] = ""
    df["label_raw"] = df["label"].astype(str)
    df["label"] = df["label_raw"].apply(map_label)
    # normalize ulasan: remove surrounding quotes if any
    if "ulasan" in df.columns:
        df["ulasan"] = df["ulasan"].astype(str).apply(lambda s: re.sub(r'^\s*["\']\s*|\s*["\']\s*$', '', s).strip())
    else:
        df["ulasan"] = ""
    # drop rows with empty ulasan or empty label (annotator didn't label)
    df = df[["ulasan","label"]].copy()
    # optionally drop empty ulasan
    df = df[df["ulasan"].astype(str).str.strip() != ""]
    # keep only rows where label is known
    df = df[df["label"].astype(str).str.strip() != ""]
    df = df.reset_index(drop=True)
    return df

def main():
    if not NEW.exists():
        raise FileNotFoundError("Annotated file not found: " + str(NEW))
    print(f"[merge_labels] Reading annotated file: {NEW}")
    df_new_raw = read_new_robust(NEW)
    print(f"[merge_labels] Raw parsed rows: {len(df_new_raw)} columns: {df_new_raw.columns.tolist()}")
    df_new = clean_new_df(df_new_raw)
    print(f"[merge_labels] Cleaned annotated rows (with mapped label): {len(df_new)}")
    # read master
    df_master = read_master_robust(MASTER) if MASTER.exists() else pd.DataFrame(columns=["ulasan","label"])
    print(f"[merge_labels] Master existing rows: {len(df_master)}")
    # prepare clean columns for dedupe
    if not df_master.empty:
        df_master = df_master.fillna("").astype(str)
        df_master["__clean"] = df_master["ulasan"].astype(str).apply(normalize_text)
    else:
        df_master["__clean"] = pd.Series(dtype=str)
    df_new["__clean"] = df_new["ulasan"].astype(str).apply(normalize_text)
    # keep only new unique
    if not df_master.empty:
        existing_set = set(df_master["__clean"].tolist())
        df_new_unique = df_new[~df_new["__clean"].isin(existing_set)].copy()
    else:
        df_new_unique = df_new.copy()
    # append to master
    combined = pd.concat([df_master[["ulasan","label"]], df_new_unique[["ulasan","label"]]], ignore_index=True)
    # final cleanup: strip whitespace on ulasan and label
    combined["ulasan"] = combined["ulasan"].astype(str).apply(lambda s: s.strip())
    combined["label"] = combined["label"].astype(str).apply(lambda s: s.strip().lower())
    # save with semicolon separator and utf-8-sig encoding
    OUT.parent.mkdir(parents=True, exist_ok=True)
    combined.to_csv(OUT, index=False, sep=';', encoding='utf-8-sig')
    print(f"[merge_labels] Merged {len(df_new_unique)} new rows. Master now has {len(combined)} rows (written to {OUT}).")

if __name__ == "__main__":
    main()
