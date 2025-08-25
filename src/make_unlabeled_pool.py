# make_unlabeled.py
from pathlib import Path
from csv_utils import robust_read_csv, write_csv_semicolon
from preprocessing import normalize_text

ALL = Path("data/all_reviews_pool.csv")
LABELED = Path("data/labeled_all.csv")
OUT = Path("data/unlabeled_pool.csv")

def main():
    if not ALL.exists():
        raise FileNotFoundError("Missing data/all_reviews_pool.csv")
    df_all = robust_read_csv(ALL)
    if "ulasan" not in [c.lower() for c in df_all.columns]:
        df_all.rename(columns={df_all.columns[0]:"ulasan"}, inplace=True)
    df_all = df_all[["ulasan"]].copy()
    if LABELED.exists():
        df_lab = robust_read_csv(LABELED)
        if "ulasan" not in [c.lower() for c in df_lab.columns]:
            df_lab.rename(columns={df_lab.columns[0]:"ulasan"}, inplace=True)
        lab_norm = set(df_lab["ulasan"].astype(str).apply(normalize_text).tolist())
        df_all["__k"] = df_all["ulasan"].astype(str).apply(normalize_text)
        pool = df_all[~df_all["__k"].isin(lab_norm)].drop(columns=["__k"])
    else:
        pool = df_all
    write_csv_semicolon(OUT, pool[["ulasan"]])
    print(f"[make_unlabeled] saved {OUT} rows={len(pool)} (sep=';')")

if __name__ == "__main__":
    main()
    
# create pool_idx
# import pandas as pd
# df = pd.read_csv("data/unlabeled_pool.csv", sep=';', encoding="utf-8-sig", engine="python", dtype=str).fillna("")
# df = df.reset_index().rename(columns={"index":"pool_idx"})[["pool_idx","ulasan"]]
# df.to_csv("data/unlabeled_pool.csv", index=False, sep=';', encoding="utf-8-sig")
# print("Indexed pool rows:", len(df))
