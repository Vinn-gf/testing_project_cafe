# sentiment.py
import os

# Matikan warning symlink Hugging Face di Windows
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from transformers import pipeline
from typing import List, Dict

class SentimentAnalyzer:
    def __init__(self):
        # Pakai model publik multilingual
        self.pipe = pipeline(
            "sentiment-analysis",
            model="nlptown/bert-base-multilingual-uncased-sentiment",
            tokenizer="nlptown/bert-base-multilingual-uncased-sentiment"
        )

    def _map_label(self, label: str) -> str:
        # "1 star" → negative, "3 stars" → neutral, "5 stars" → positive
        stars = int(label.split()[0])
        if stars <= 2:
            return "negative"
        if stars == 3:
            return "neutral"
        return "positive"

    def predict(self, text: str) -> str:
        out = self.pipe(text[:512])[0]
        return self._map_label(out["label"])

    def analyze_reviews(self, reviews: List[Dict], id_kafe: int) -> List[Dict]:
        result = []
        for r in reviews:
            teks = r.get("ulasan", "")
            label = self.predict(teks)
            result.append({
                "id_kafe":      id_kafe,
                "waktu_ulasan": str(r.get("waktu_ulasan", "")),
                "username":     str(r.get("nama", "")),
                "ulasan":       teks,
                "sentiment":    label
            })
        return result
