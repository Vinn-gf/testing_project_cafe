# sentiment.py
import re
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.svm import LinearSVC
from sklearn.pipeline import Pipeline
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import classification_report

class SentimentAnalyzer:
    def __init__(self,
                 model_path: str = "svm_sentiment_pipeline.joblib",
                 force_retrain: bool = False):
        """
        Jika model_path tidak ada atau force_retrain=True, kita akan
        melatih ulang model dari dataset labeled_reviews.csv.
        """
        self.model_path = model_path
        if force_retrain or not os.path.isfile(model_path):
            self._train_and_persist()
        self.pipe = joblib.load(model_path)

    def _preprocess(self, text: str) -> str:
        # 1) lowercase
        t = text.lower()
        # 2) normalisasi singkatan
        slang = {
            r"\bbgt\b": "banget",
            r"\bny\b": "nya",
            r"\bkrn\b": "karena",
            r"\bsmg\b": "semoga",
        }
        for pat, rep in slang.items():
            t = re.sub(pat, rep, t)
        # 3) hilangkan non-alfanumerik
        t = re.sub(r"[^a-z0-9\s]", " ", t)
        # 4) collapse whitespace
        t = re.sub(r"\s+", " ", t).strip()
        return t

    def _train_and_persist(self):
        # dataset minimal: labeled_reviews.csv dengan kolom ['ulasan','label']
        df = pd.read_csv("labeled_reviews.csv")
        df = df.dropna(subset=["ulasan","label"])
        df["ulasan"] = df["ulasan"].map(self._preprocess)

        X_train, X_test, y_train, y_test = train_test_split(
            df["ulasan"], df["label"], test_size=0.2, random_state=42, stratify=df["label"]
        )

        # pipeline dengan bigram + TF-IDF + LinearSVC (+ gridsearch ringan)
        base_pipe = Pipeline([
            ("vect", TfidfVectorizer(ngram_range=(1,2), min_df=3)),
            ("clf", LinearSVC())
        ])
        param_grid = {
            "clf__C": [0.1, 1, 10]
        }
        gs = GridSearchCV(base_pipe, param_grid, cv=3, scoring="accuracy", n_jobs=-1)
        gs.fit(X_train, y_train)

        # evaluasi singkat
        y_pred = gs.predict(X_test)
        print("=== Sentiment model performance ===")
        print(classification_report(y_test, y_pred))

        # simpan pipeline terbaik
        joblib.dump(gs.best_estimator_, self.model_path)
        print(f"Model tersimpan di {self.model_path}")

    def predict(self, text: str) -> str:
        """Kembalikan 'positive' atau 'negative'."""
        clean = self._preprocess(text)
        return self.pipe.predict([clean])[0]

    def summary_for_cafe(self, reviews: list) -> dict:
        """
        reviews: list of dict, tiap dict mengandung kunci 'ulasan'
        Kembalikan ringkasan { 'positive': n_pos, 'negative': n_neg }
        """
        labels = [ self.predict(r["ulasan"]) for r in reviews ]
        pos = labels.count("positive")
        neg = labels.count("negative")
        total = pos + neg or 1
        return {
            "total_reviews": total,
            "positive":      pos,
            "negative":      neg,
            "pct_positive":  round(pos/total, 4),
            "pct_negative":  round(neg/total, 4)
        }
