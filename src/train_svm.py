# scripts/train_svm.py
import os, csv
import pandas as pd
import joblib
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from preprocessing import normalize_text

# Paths
DATA_FILE = "data/labeled_all.csv"
MODEL_DIR = "models"
MODEL_FILE = os.path.join(MODEL_DIR, "svm_sentiment_pipeline.joblib")
HOLDOUT_FILE = "data/holdout.csv"

os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs("data", exist_ok=True)

def robust_read_csv(path):
    """Try to read CSV by sniffing delimiter and using pandas with safe options."""
    import io
    import pandas as pd
    import csv
    with open(path, "rb") as f:
        sample = f.read(4096)
    # try decode sample as utf-8, fallback to latin-1
    try:
        sample_text = sample.decode("utf-8")
        encoding = "utf-8"
    except:
        try:
            sample_text = sample.decode("latin-1")
            encoding = "latin-1"
        except:
            sample_text = sample.decode("utf-8", errors="replace")
            encoding = "utf-8"
    sniffer = csv.Sniffer()
    try:
        dialect = sniffer.sniff(sample_text)
        sep = dialect.delimiter
    except Exception:
        sep = ","
    # read with pandas, allow bad lines to be reported (but not crash)
    df = pd.read_csv(path, sep=sep, encoding=encoding, quotechar='"', on_bad_lines='warn', engine='python', dtype=str)
    return df

if not os.path.exists(DATA_FILE):
    raise FileNotFoundError(f"{DATA_FILE} not found - create data/labeled_all.csv first (cols: ulasan,label)")

df = robust_read_csv(DATA_FILE)
# normalize column names
df.columns = [c.strip() for c in df.columns]
if "ulasan" not in df.columns or "label" not in df.columns:
    raise ValueError("CSV must have columns: 'ulasan' and 'label'")

# drop rows missing col
df = df.dropna(subset=["ulasan","label"]).copy()
# normalize text (keamanan: ensure utf-8 strings)
df["clean"] = df["ulasan"].astype(str).apply(normalize_text)
y = df["label"].astype(str).values

# optional: create holdout if not exists
if not os.path.exists(HOLDOUT_FILE):
    X_train, X_hold, y_train, y_hold = train_test_split(df["clean"], y, test_size=0.12, random_state=42, stratify=y)
    pd.DataFrame({"ulasan": X_hold, "label": y_hold}).to_csv(HOLDOUT_FILE, index=False, encoding="utf-8")
    df_train = pd.DataFrame({"clean": X_train, "label": y_train})
else:
    hold = robust_read_csv(HOLDOUT_FILE)
    hold["ulasan"] = hold["ulasan"].astype(str)
    # remove holdout rows from df by content match on normalized form
    hold["clean"] = hold["ulasan"].apply(normalize_text)
    df = df[~df["clean"].isin(hold["clean"])]
    df_train = df[["clean","label"]]

X = df_train["clean"].tolist()
y = df_train["label"].tolist()

# train/val split for validation metrics
X_tr, X_val, y_tr, y_val = train_test_split(X, y, test_size=0.15, random_state=42, stratify=y)

pipe = Pipeline([
    ("tfidf", TfidfVectorizer(max_features=10000, ngram_range=(1,2))),
    ("svm", LinearSVC(class_weight="balanced", max_iter=10000))
])

print("Training SVM...")
pipe.fit(X_tr, y_tr)
print("Predicting validation set...")
y_pred = pipe.predict(X_val)
print("Accuracy:", accuracy_score(y_val, y_pred))
print(classification_report(y_val, y_pred))

# Save model
joblib.dump(pipe, MODEL_FILE)
print("Saved model to", MODEL_FILE)
