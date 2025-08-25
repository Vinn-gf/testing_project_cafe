# select_uncertain.py
from pathlib import Path
import joblib, numpy as np
from csv_utils import robust_read_csv, write_csv_semicolon
from preprocessing import normalize_text

MODEL_FILE = Path("models/svm_sentiment_pipeline.joblib")
UNLABELED = Path("data/unlabeled_pool.csv")
OUT = Path("data/to_label_round.csv")

def main(n=200):
    if not MODEL_FILE.exists():
        raise FileNotFoundError("Model not found. Run train_svm.py first.")
    if not UNLABELED.exists():
        raise FileNotFoundError("Unlabeled pool not found: " + str(UNLABELED))
    pipe = joblib.load(MODEL_FILE)
    tfidf = pipe.named_steps["tfidf"]
    clf = pipe.named_steps["svm"]

    df = robust_read_csv(UNLABELED)
    if "pool_idx" not in df.columns:
        df = df.reset_index().rename(columns={"index":"pool_idx"})[["pool_idx","ulasan"]]
    df["clean"] = df["ulasan"].astype(str).apply(normalize_text)
    X = tfidf.transform(df["clean"].tolist())
    decisions = clf.decision_function(X)
    if isinstance(decisions, np.ndarray) and decisions.ndim == 1:
        uncertainty = np.abs(decisions)
    else:
        sorted_scores = np.sort(decisions, axis=1)
        top1 = sorted_scores[:, -1]
        top2 = sorted_scores[:, -2]
        uncertainty = np.abs(top1 - top2)
    df["uncertainty"] = uncertainty
    df_sorted = df.sort_values("uncertainty", ascending=True)
    sel = df_sorted.head(n)[["pool_idx","ulasan"]].copy()
    write_csv_semicolon(OUT, sel)
    print(f"[select_uncertain] saved {len(sel)} rows -> {OUT} (sep=';')")

if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=200)
    args = ap.parse_args()
    main(n=args.n)
