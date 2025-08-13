# scripts/select_uncertain_with_index.py
import os, joblib, numpy as np
import pandas as pd
from preprocessing import normalize_text  # or use your normalize function

MODEL_FILE = "models/svm_sentiment_pipeline.joblib"
UNLABELED_FILE = "data/unlabeled_pool.csv"
OUT_FILE = "data/to_label_round.csv"
N = 200

if not os.path.exists(MODEL_FILE):
    raise FileNotFoundError("Model not found. Run train_svm.py first.")
if not os.path.exists(UNLABELED_FILE):
    raise FileNotFoundError("Unlabeled pool not found: " + UNLABELED_FILE)

pipe = joblib.load(MODEL_FILE)
tfidf = pipe.named_steps["tfidf"]
clf = pipe.named_steps["svm"]

# read pool and reset_index to create pool_idx
df = pd.read_csv(UNLABELED_FILE, encoding="utf-8", dtype=str, on_bad_lines='warn').fillna("")
df = df.reset_index().rename(columns={"index":"pool_idx"})
if "ulasan" not in df.columns:
    raise ValueError("Unlabeled pool CSV must contain column 'ulasan'")

df["clean"] = df["ulasan"].astype(str).apply(normalize_text)

X_vec = tfidf.transform(df["clean"].tolist())
decisions = clf.decision_function(X_vec)

if isinstance(decisions, np.ndarray) and decisions.ndim == 1:
    uncertainty = np.abs(decisions)
else:
    sorted_scores = np.sort(decisions, axis=1)
    top1 = sorted_scores[:, -1]
    top2 = sorted_scores[:, -2]
    uncertainty = np.abs(top1 - top2)

df["uncertainty"] = uncertainty
df_sorted = df.sort_values("uncertainty", ascending=True)
selected = df_sorted.head(N)[["pool_idx","ulasan"]].copy()
selected.to_csv(OUT_FILE, index=False, encoding="utf-8-sig")
print(f"Saved {len(selected)} rows to {OUT_FILE} (with pool_idx).")
