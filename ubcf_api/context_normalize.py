import pandas as pd
import time
import numpy as np 

try:
    from main import (
        build_cf_model,
        normalize_number,
        compute_sentiment_for_cafe,
        compute_sentiment_score_from_reviews,
        safe_get,
        fetch_cafe,
        invalidate_caches,
        BASE
    )
except ImportError as e:
    print(f"Error: Gagal mengimpor fungsi dari 'main.py'. Pastikan file ada di direktori yang sama.")
    print(f"Detail error: {e}")
    exit()

mat, _, _ = build_cf_model()

if mat.empty:
    print("Error: Gagal membangun model. Tidak ada data?")
    exit()

id = mat.columns.tolist()
if not id:
    print("Error: Tidak ada ID kafe ditemukan dalam matriks.")
    exit()

cafe_id = id[2] 

print(f"ID Kafe: {cafe_id}")
info_cafe = fetch_cafe(cafe_id) or {}
rating_val = info_cafe.get("rating", "N/A")

rating_n = "N/A"
rating_val_f = 0.0
if rating_val != "N/A":
    try:
        rating_val_f = float(rating_val)
        rating_n = normalize_number(rating_val_f, cap=5.0)
    except (ValueError, TypeError):
        rating_val = "Invalid"

sent_n_smoothed = compute_sentiment_for_cafe(cafe_id)
sent_n_smoothed = float(sent_n_smoothed) if sent_n_smoothed is not None else 0.5

reviews = None
data_sent = safe_get(f"{BASE}/api/sentiment/{cafe_id}")
if isinstance(data_sent, list):
    reviews = data_sent
elif isinstance(data_sent, dict):
    if "reviews" in data_sent and isinstance(data_sent["reviews"], list):
        reviews = data_sent["reviews"]
    else:
        arr = []
        for v in data_sent.values():
            if isinstance(v, list): arr.extend(v)
        if arr: reviews = arr
if reviews is None:
    raw_rev = safe_get(f"{BASE}/api/reviews/{cafe_id}")
    if isinstance(raw_rev, list):
        reviews = raw_rev
    elif isinstance(raw_rev, dict) and "reviews" in raw_rev and isinstance(raw_rev["reviews"], list):
        reviews = raw_rev

raw_sentiment_scores = []
raw_mean_sentiment = "N/A"
if reviews and isinstance(reviews, list):
    for r in reviews:
        if not isinstance(r, dict): continue
        p_pos = float(r.get("p_pos", r.get("prob_pos", 0.0)))
        p_neu = float(r.get("p_neu", r.get("prob_neu", 0.0)))
        p_neg = float(r.get("p_neg", r.get("prob_neg", 0.0)))
        if p_pos or p_neu or p_neg:
            s = p_pos * 1.0 + p_neu * 0.5 + p_neg * 0.0
            raw_sentiment_scores.append(s)
            continue
        else:
            lab = (r.get("sentiment") or r.get("label") or "").strip().lower()
            if lab:
                if lab.startswith("pos"): raw_sentiment_scores.append(1.0)
                elif lab.startswith("neg"): raw_sentiment_scores.append(0.0)
                else: raw_sentiment_scores.append(0.5)

    if raw_sentiment_scores:
        raw_mean_sentiment = np.mean(raw_sentiment_scores)
    else:
        print("Tidak ada ulasan valid ditemukan untuk menghitung sentimen mentah.")
else:
    print("Tidak ada data ulasan ditemukan.")


print(f"  - Rating Asli (belum dinormalisasi)               : {rating_val}")
if rating_n != "N/A":
    print(f"  - Rating Setelah Normalisasi                      : {rating_n:.2f}")
else:
    print(f"  - Rating Setelah Normalisasi   : N/A")

if raw_mean_sentiment != "N/A":
    print(f"  - Sentimen Mentah (belum dinormalisasi)           : {raw_mean_sentiment:.2f}")
else:
     print(f"  - Sentimen Mentah (Rata-rata): N/A")
print(f"  - Sentimen Setelah Normalisasi                    : {sent_n_smoothed:.2f}")

print("Proses selesai.")