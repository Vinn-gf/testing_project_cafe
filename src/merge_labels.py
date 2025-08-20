# scripts/merge_labels.py
import os, pandas as pd
from preprocessing import normalize_text

MASTER = "data/labeled_all.csv"
NEW = "data/to_label_round_labeled.csv"  # annotator output must contain pool_idx, ulasan, label
OUT = MASTER

if not os.path.exists(NEW):
    raise FileNotFoundError(f"New labeled file not found: {NEW}")

df_master = pd.read_csv(MASTER, encoding="utf-8", sep=",", on_bad_lines='warn', dtype=str) if os.path.exists(MASTER) else pd.DataFrame(columns=["ulasan","label"])
# load robustly
df_new = pd.read_csv(NEW, encoding="utf-8", sep=";", on_bad_lines='warn', dtype=str)

# ensure columns present
if "ulasan" not in df_new.columns or "label" not in df_new.columns:
    raise ValueError("New labeled CSV must have columns: 'ulasan' and 'label'")

# normalize to compare and avoid duplicates
df_master["clean"] = df_master["ulasan"].astype(str).apply(normalize_text) if not df_master.empty else pd.Series(dtype=str)
df_new["clean"] = df_new["ulasan"].astype(str).apply(normalize_text)

# remove new rows already present (by clean text)
if not df_master.empty:
    existing = set(df_master["clean"].tolist())
    df_new = df_new[~df_new["clean"].isin(existing)]

# append and save
combined = pd.concat([df_master[["ulasan","label"]], df_new[["ulasan","label"]]], ignore_index=True)
combined.to_csv(OUT, index=False, encoding="utf-8")
print(f"Merged {len(df_new)} new rows. Master now has {len(combined)} rows.")
