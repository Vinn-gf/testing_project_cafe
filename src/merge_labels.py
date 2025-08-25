# merge_labels.py
from pathlib import Path
from csv_utils import robust_read_csv, write_csv_semicolon
from preprocessing import normalize_text
import pandas as pd

NEW = Path("data/to_label_round_labeled.csv")
MASTER = Path("data/labeled_all.csv")

def main():
    if not NEW.exists():
        raise FileNotFoundError("Annotated file not found: data/to_label_round_labeled.csv")
    df_new = robust_read_csv(NEW)
    cols_lower = {c.strip().lower(): c for c in df_new.columns}
    if "ulasan" in cols_lower:
        df_new = df_new.rename(columns={cols_lower["ulasan"]:"ulasan"})
    elif "review" in cols_lower:
        df_new = df_new.rename(columns={cols_lower["review"]:"ulasan"})
    else:
        if len(df_new.columns) == 1:
            df_new.columns = ["ulasan"]
        else:
            raise ValueError("Annotated file must contain 'ulasan' column")
    if "label" in cols_lower:
        df_new = df_new.rename(columns={cols_lower["label"]:"label"})
    else:
        if "label" not in df_new.columns and len(df_new.columns) >= 2:
            df_new = df_new.rename(columns={df_new.columns[-1]:"label"})
        else:
            raise ValueError("Annotated file must contain 'label' column")
    df_new = df_new.fillna("").astype(str)
    df_new["label"] = df_new["label"].str.lower().str.strip()
    df_new = df_new[["ulasan","label"]]

    if MASTER.exists():
        df_master = robust_read_csv(MASTER)
        if "ulasan" not in [c.lower() for c in df_master.columns]:
            df_master.rename(columns={df_master.columns[0]:"ulasan"}, inplace=True)
        if "label" not in [c.lower() for c in df_master.columns] and len(df_master.columns)>=2:
            df_master.rename(columns={df_master.columns[-1]:"label"}, inplace=True)
    else:
        df_master = pd.DataFrame(columns=["ulasan","label"])
    df_master = df_master.fillna("").astype(str)

    df_master["__clean"] = df_master["ulasan"].astype(str).apply(normalize_text) if not df_master.empty else pd.Series(dtype=str)
    df_new["__clean"] = df_new["ulasan"].astype(str).apply(normalize_text)

    if not df_master.empty:
        existing = set(df_master["__clean"].tolist())
        df_new_unique = df_new[~df_new["__clean"].isin(existing)].copy()
    else:
        df_new_unique = df_new.copy()

    combined = pd.concat([df_master[["ulasan","label"]], df_new_unique[["ulasan","label"]]], ignore_index=True)
    write_csv_semicolon(MASTER, combined)
    print(f"[merge_labels] Merged {len(df_new_unique)} new rows. Master now has {len(combined)} rows (sep=';').")

if __name__ == "__main__":
    main()
