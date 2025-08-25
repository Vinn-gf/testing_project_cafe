# scripts/apply_labels_nohash.py
import pandas as pd, re
from pathlib import Path

UNLAB = Path("data/unlabeled_pool.csv")
LABELED = Path("data/to_label_round_labeled.csv")
OUT = Path("data/to_label_round_mapped.csv")
UNMATCH = Path("data/to_label_round_unmatched.csv")

def norm(s):
    if pd.isna(s): return ""
    t = str(s).lower()
    t = re.sub(r"\s+"," ", t).strip()
    return t

if not UNLAB.exists():
    raise SystemExit("Missing: data/unlabeled_pool.csv")
if not LABELED.exists():
    raise SystemExit("Missing: data/to_label_round_labeled.csv")

# read pool and ensure pool_idx
df_pool = pd.read_csv(UNLAB, encoding="utf-8-sig", dtype=str, engine="python").fillna("")
df_pool = df_pool.reset_index().rename(columns={"index":"pool_idx"})
df_pool['clean'] = df_pool['ulasan'].astype(str).apply(norm)

# read labeled by annotator
df_lab = pd.read_csv(LABELED, encoding="utf-8-sig", dtype=str, engine="python").fillna("")
# normalisasi label values
if 'label' in df_lab.columns:
    df_lab['label'] = df_lab['label'].astype(str).str.lower().str.strip()
else:
    raise SystemExit("Annotator file must contain 'label' column.")
df_lab['clean'] = df_lab['ulasan'].astype(str).apply(norm)

mapped=[]
unmatched=[]
for _, r in df_lab.iterrows():
    mapped_row = None
    # try pool_idx if present and not empty
    if 'pool_idx' in df_lab.columns and str(r.get('pool_idx','')).strip() != "":
        try:
            pid = int(r['pool_idx'])
            tmp = df_pool[df_pool['pool_idx']==pid]
            if not tmp.empty:
                mapped_row = tmp.iloc[0]
        except Exception:
            mapped_row = None
    # fallback: try normalized exact match
    if mapped_row is None:
        tmp = df_pool[df_pool['clean']==r['clean']]
        if not tmp.empty:
            # if multiple matches, take first
            mapped_row = tmp.iloc[0]
    if mapped_row is None:
        unmatched.append(r.to_dict())
    else:
        mapped.append({
            "pool_idx": int(mapped_row['pool_idx']),
            "ulasan": mapped_row['ulasan'],
            "label": r['label']
        })

df_mapped = pd.DataFrame(mapped)
df_unmatched = pd.DataFrame(unmatched)
df_mapped.to_csv(OUT, index=False, encoding="utf-8-sig")
if not df_unmatched.empty:
    df_unmatched.to_csv(UNMATCH, index=False, encoding="utf-8-sig")
    print(f"Mapped: {len(df_mapped)} rows. Unmatched: {len(df_unmatched)} -> saved {UNMATCH}")
else:
    print(f"Mapped: {len(df_mapped)} rows. No unmatched.")
