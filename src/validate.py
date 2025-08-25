# validate_pool.py
from pathlib import Path
import pandas as pd
from preprocessing import normalize_text

ALL_FIXED = Path("data/all_reviews_pool.csv")
UNLABELED = Path("data/unlabeled_pool.csv")

def main():
    if not ALL_FIXED.exists() or not UNLABELED.exists():
        print("Required files missing. Make sure all_reviews_pool.fixed.csv and unlabeled_pool.csv exist.")
        return
    a = pd.read_csv(ALL_FIXED, sep=';', encoding='utf-8-sig', engine='python', dtype=str).fillna("")
    u = pd.read_csv(UNLABELED, sep=';', encoding='utf-8-sig', engine='python', dtype=str).fillna("")
    a_cols = a.columns.tolist()
    if 'ulasan' not in [c.lower() for c in a_cols]:
        a.columns = ['ulasan']
    if 'ulasan' not in [c.lower() for c in u.columns.tolist()]:
        u.columns = ['ulasan']
    a['clean'] = a['ulasan'].astype(str).apply(normalize_text)
    u['clean'] = u['ulasan'].astype(str).apply(normalize_text)
    set_u = set(u['clean'].tolist())
    missing = a[~a['clean'].isin(set_u)]
    print(f"[validate] total all_reviews.fixed: {len(a)}, unlabeled: {len(u)}, missing (not in unlabeled): {len(missing)}")
    if len(missing) > 0:
        print("Examples of missing (original -> normalized preview):")
        for i,row in missing.head(10).iterrows():
            print("-", row['ulasan'][:160], "->", row['clean'][:120])
    else:
        print("All fine: every normalized review from all_reviews_pool.fixed exists in unlabeled_pool (modulo normalization).")

if __name__ == "__main__":
    main()
