# train_svm.py
from pathlib import Path
from csv_utils import robust_read_csv, write_csv_semicolon
from preprocessing import normalize_text
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import joblib, pandas as pd

LABELED = Path("data/labeled_all.csv")
MODEL_FILE = Path("models/svm_sentiment_pipeline.joblib")
TFIDF_PARAMS = {"max_features":30000, "ngram_range":(1,2)}

def main(test_size=0.2, random_state=42, save_iter_model=False, iter_tag="latest"):
    if not LABELED.exists():
        raise FileNotFoundError("labeled_all.csv not found")
    df = robust_read_csv(LABELED)
    if "ulasan" not in [c.lower() for c in df.columns]:
        df.rename(columns={df.columns[0]:"ulasan"}, inplace=True)
    if "label" not in [c.lower() for c in df.columns]:
        if len(df.columns) >= 2:
            df.rename(columns={df.columns[-1]:"label"}, inplace=True)
        else:
            raise ValueError("labeled_all.csv must have 'ulasan' and 'label'")
    df = df[["ulasan","label"]].fillna("").astype(str)
    df = df[df["label"].str.strip()!=""]
    if df.empty:
        raise ValueError("No labeled rows found for training")
    X = df["ulasan"].astype(str).apply(normalize_text).tolist()
    y = df["label"].astype(str).tolist()
    try:
        X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=test_size, random_state=random_state, stratify=y)
    except Exception:
        X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=test_size, random_state=random_state)
    print("[train] Training SVM (TF-IDF + LinearSVC)...")
    pipe = Pipeline([
        ("tfidf", TfidfVectorizer(**TFIDF_PARAMS)),
        ("svm", LinearSVC(class_weight="balanced", max_iter=20000))
    ])
    pipe.fit(X_train, y_train)
    y_pred = pipe.predict(X_val)
    acc = accuracy_score(y_val, y_pred)
    print(f"[train] Accuracy: {acc:.4f}")
    print(classification_report(y_val, y_pred, digits=4))
    MODEL_FILE.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, MODEL_FILE)
    if save_iter_model:
        import shutil
        outp = MODEL_FILE.parent / f"svm_sentiment_{iter_tag}.joblib"
        shutil.copy(MODEL_FILE, outp)
        print(f"[train] also saved iteration model -> {outp}")
    print(f"[train] Saved model -> {MODEL_FILE}")

if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--test-size", type=float, default=0.2)
    ap.add_argument("--random-state", type=int, default=42)
    ap.add_argument("--save-iter-model", action="store_true")
    ap.add_argument("--iter-tag", type=str, default="iter")
    args = ap.parse_args()
    main(test_size=args.test_size, random_state=args.random_state, save_iter_model=args.save_iter_model, iter_tag=args.iter_tag)
