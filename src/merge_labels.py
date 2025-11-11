from pathlib import Path
import re
import csv
import pandas as pd
from typing import Tuple, List, Dict

from preprocessing import normalize_text

NEW = Path("data/to_label_round_labeled.csv")
MASTER = Path("data/labeled_all.csv")
OUT = MASTER

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
    s = re.sub(r'^["\']+|["\']+$', '', s).strip()
    parts = re.split(r'[\s,;/]+', s)
    for p in parts:
        if p in VALID_LABELS:
            return VALID_LABELS[p]
    if s in VALID_LABELS:
        return VALID_LABELS[s]
    for key in VALID_LABELS:
        if key in s:
            return VALID_LABELS[key]
    return ""  

def try_pandas_read(path: Path) -> Tuple[pd.DataFrame, str, str]:
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
                cols = [c.strip().lower() for c in df.columns.tolist()]
                score = 0
                if len(df) > 0:
                    score += min(10, len(df)//10)
                if "label" in cols:
                    score += 30
                if "ulasan" in cols or "review" in cols or "comment" in cols:
                    score += 20
                score += max(0, 10 - abs(len(cols)-2))
                if score > best_score:
                    best_score = score
                    best = (df, enc, sep)
            except Exception:
                continue
    if best is None:
        raise RuntimeError("failed to read the file")
    df, enc, sep = best
    return df, enc, sep

def fallback_csv_reader(path: Path) -> pd.DataFrame:
    text = path.read_text(encoding="utf-8", errors="replace")
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
    rows = [r for r in best_rows if any((c or "").strip() for c in r)]
    first = rows[0]
    first_lower = [ (c or "").strip().lower() for c in first ]
    has_header = any(x in ("label","ulasan","review","comment","pool_idx") for x in first_lower)
    data_rows = rows[1:] if has_header else rows
    normalized = []
    for r in data_rows:
        r = [ (c or "").strip() for c in r ]
        if len(r) == 1:
            cell = r[0]
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
            if r[1].lower() in ("positive","negative","neutral","pos","neg","neu","positif","negatif"):
                normalized.append({"ulasan": r[0], "label": r[1]})
            elif r[0].lower() in ("positive","negative","neutral","pos","neg","neu","positif","negatif"):
                normalized.append({"ulasan": r[1], "label": r[0]})
            else:
                if r[0].isdigit():
                    normalized.append({"pool_idx": r[0], "ulasan": r[1], "label": ""})
                else:
                    normalized.append({"ulasan": r[0], "label": r[1]})
        else:
            label_idx = None
            for i,cell in enumerate(r):
                if (cell or "").lower() in ("positive","negative","neutral","pos","neg","neu","positif","negatif"):
                    label_idx = i
                    break
            if label_idx is None:
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
    try:
        df, enc, sep = try_pandas_read(path)
        cols_map = {c.strip().lower(): c for c in df.columns.tolist()}
        if "ulasan" in cols_map:
            df = df.rename(columns={cols_map["ulasan"]: "ulasan"})
        elif "review" in cols_map:
            df = df.rename(columns={cols_map["review"]: "ulasan"})
        if "label" in cols_map:
            df = df.rename(columns={cols_map["label"]: "label"})
        if "ulasan" not in df.columns and len(df.columns)==1:
            df.columns = ["ulasan"]
        if "label" not in df.columns and len(df.columns)>=2:
            df = df.rename(columns={df.columns[-1]: "label"})
        df = df.fillna("").astype(str)
        if "label" not in df.columns:
            parsed = fallback_csv_reader(path)
            return parsed
        cols = [c for c in ["pool_idx","ulasan","label"] if c in df.columns]
        if "pool_idx" in df.columns:
            return df[cols].copy()
        else:
            return df[["ulasan","label"]].copy()
    except Exception:
        return fallback_csv_reader(path)

def read_master_robust(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame(columns=["ulasan","label"])
    try:
        df = read_new_robust(path)
        if "ulasan" not in df.columns:
            if len(df.columns) == 1:
                df.columns = ["ulasan"]
            else:
                df = df.iloc[:, :2]
                df.columns = ["ulasan","label"]
        if "label" not in df.columns:
            df["label"] = ""
        df = df[["ulasan","label"]].fillna("").astype(str)
        return df
    except Exception:
        return pd.DataFrame(columns=["ulasan","label"])

def clean_new_df(df: pd.DataFrame) -> pd.DataFrame:
    if "label" not in df.columns:
        df["label"] = ""
    df["label_raw"] = df["label"].astype(str)
    df["label"] = df["label_raw"].apply(map_label)
    if "ulasan" in df.columns:
        df["ulasan"] = df["ulasan"].astype(str).apply(lambda s: re.sub(r'^\s*["\']\s*|\s*["\']\s*$', '', s).strip())
    else:
        df["ulasan"] = ""
    df = df[["ulasan","label"]].copy()
    df = df[df["ulasan"].astype(str).str.strip() != ""]
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
    df_master = read_master_robust(MASTER) if MASTER.exists() else pd.DataFrame(columns=["ulasan","label"])
    print(f"[merge_labels] Master existing rows: {len(df_master)}")
    if not df_master.empty:
        df_master = df_master.fillna("").astype(str)
        df_master["__clean"] = df_master["ulasan"].astype(str).apply(normalize_text)
    else:
        df_master["__clean"] = pd.Series(dtype=str)
    df_new["__clean"] = df_new["ulasan"].astype(str).apply(normalize_text)
    if not df_master.empty:
        existing_set = set(df_master["__clean"].tolist())
        df_new_unique = df_new[~df_new["__clean"].isin(existing_set)].copy()
    else:
        df_new_unique = df_new.copy()
    combined = pd.concat([df_master[["ulasan","label"]], df_new_unique[["ulasan","label"]]], ignore_index=True)
    combined["ulasan"] = combined["ulasan"].astype(str).apply(lambda s: s.strip())
    combined["label"] = combined["label"].astype(str).apply(lambda s: s.strip().lower())
    OUT.parent.mkdir(parents=True, exist_ok=True)
    combined.to_csv(OUT, index=False, sep=';', encoding='utf-8-sig')
    print(f"[merge_labels] Merged {len(df_new_unique)} new rows. Master now has {len(combined)} rows (written to {OUT}).")

if __name__ == "__main__":
    main()
