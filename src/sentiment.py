# scripts/sentiment_svm_loader.py
import joblib, os
from preprocessing import normalize_text

MODEL_FILE = "models/svm_sentiment_pipeline.joblib"
if not os.path.exists(MODEL_FILE):
    raise FileNotFoundError("Model not found. Train SVM first.")

pipe = joblib.load(MODEL_FILE)

def analyze_reviews(reviews, id_kafe):
    out = []
    for r in reviews:
        text = r.get("ulasan","")
        clean = normalize_text(text)
        label = pipe.predict([clean])[0]
        out.append({
            "id_kafe": id_kafe,
            "waktu_ulasan": str(r.get("waktu_ulasan","")),
            "username": str(r.get("nama","")),
            "ulasan": text,
            "sentiment": label
        })
    return out
