# main.py

# ── 1) Install & import ───────────────────────────────────────────────────────────
# Pastikan di virtual environment Anda sudah ter‐install:
# flask, flask-cors, pandas, numpy, scikit-learn, requests, tabulate

from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import pandas as pd
import numpy as np
import json
from sklearn.neighbors import NearestNeighbors
from collections import defaultdict

# ── 2) Inisialisasi Flask App & CORS ───────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

# ── 3) Konfigurasi BASE URL untuk REST API Front‐End ────────────────────────────────
# Ganti BASE sesuai alamat penerbit data Anda (misal ngrok atau domain Anda)
BASE = "http://127.0.0.1:8080"
session = requests.Session()
session.headers.update({"ngrok-skip-browser-warning": "true"})


# ── 4) Helper untuk mengambil data dari Front‐End API ──────────────────────────────
def fetch_all_user_ids():
    """
    GET /api/users  →  [{'id_user':1,...}, ...]
    return: [1,2,3,...]
    """
    r = session.get(f"{BASE}/api/users")
    r.raise_for_status()
    users = r.json()
    return [int(u["id_user"]) for u in users if isinstance(u, dict) and "id_user" in u]


def fetch_user(user_id):
    """
    GET /api/users/{user_id} → detail user (termasuk menu_yang_disukai, cafe_telah_dikunjungi)
    return: dict
    """
    r = session.get(f"{BASE}/api/users/{user_id}")
    r.raise_for_status()
    return r.json()


def fetch_visited(user_id):
    """
    GET /api/visited/{user_id} → { "visited_cafes": [ { "id_cafe": ... }, ... ] }
    return: list of { "id_cafe": int }
    """
    r = session.get(f"{BASE}/api/visited/{user_id}")
    r.raise_for_status()
    data = r.json()
    if isinstance(data, dict):
        return data.get("visited_cafes", [])
    return data if isinstance(data, list) else []


def fetch_cafe(cafe_id):
    """
    GET /api/cafe/{cafe_id} → detail kafe, misal {
       "cafe_id":..., "nama_kafe":..., "rating":..., "alamat":..., dsb.
    }
    return: dict
    """
    r = session.get(f"{BASE}/api/cafe/{cafe_id}")
    r.raise_for_status()
    return r.json()


# ── 5) Bangun User–Item Matrix dari menu_yang_disukai ───────────────────────────────
records = []
all_user_ids = fetch_all_user_ids()

for uid in all_user_ids:
    u = fetch_user(uid)
    raw = u.get("menu_yang_disukai") or "[]"
    try:
        favs = json.loads(raw) if isinstance(raw, str) else raw
    except:
        favs = []

    if isinstance(favs, list):
        for m in favs:
            if isinstance(m, dict) and "harga" in m and "id_cafe" in m:
                try:
                    price = int(str(m["harga"]).replace(".", ""))
                    cid = int(m["id_cafe"])
                    records.append({
                        "user_id": uid,
                        "cafe_id": cid,
                        "harga": price
                    })
                except:
                    # Lewati entri yang tidak valid
                    pass

df_menu = pd.DataFrame(records)
if df_menu.empty:
    mat = pd.DataFrame()  # Tidak ada data menu_yang_disukai
else:
    mat = df_menu.pivot_table(
        index="user_id",
        columns="cafe_id",
        values="harga",
        fill_value=0
    )


# ── 6) Hitung Adjusted Cosine Similarity & Bangun KNN ──────────────────────────────
if not mat.empty and mat.shape[0] > 1:
    # Centering: X = mat - rata2 per baris
    X = mat.sub(mat.mean(axis=1), axis=0)
    # Numerator = X · X^T
    num = X.dot(X.T)
    # Denominator = ||X_i|| · ||X_j|| + ε
    norm = np.sqrt((X**2).sum(axis=1).to_numpy())
    den = np.outer(norm, norm) + 1e-8
    # sim_vals = num / den
    sim_vals = np.divide(
        num.values,
        den,
        out=np.zeros_like(num.values),
        where=den > 0
    )
    sim = pd.DataFrame(
        np.clip(sim_vals, -1, 1),
        index=mat.index,
        columns=mat.index
    )
    # Distance matrix = 1 - similarity
    dist_matrix = 1 - sim
    # Fit KNN dengan metric precomputed
    knn = NearestNeighbors(
        metric="precomputed",
        n_neighbors=min(5, len(dist_matrix))
    )
    knn.fit(dist_matrix.values)
else:
    sim = pd.DataFrame()
    knn = None


# ── 7) Fungsi Menghitung Weighted‐Sum Score (Alur “menu_yang_disukai”) ─────────────────
def get_menu_scores(user_id):
    """
    Hitung skor weighted‐sum untuk setiap cafe: 
    Σ( kemiripan(user,user_neigh) * harga_neigh(cafe) ) / Σ(|kemiripan|)
    return: dict { cafe_id: score }, hanya untuk cid dengan skor>0
    """
    if knn is None or user_id not in sim.index:
        return {}

    # Cari K+1 neighbor (termasuk diri sendiri)
    n_nb = min(len(sim), sim.shape[0])  # ambil sebanyak mungkin kalau <6
    dists, idxs = knn.kneighbors(
        (1 - sim).loc[[user_id]].values,
        n_neighbors=n_nb
    )
    neigh = sim.index[idxs[0][1:]]  # skip diri sendiri

    scores = {}
    for cid in mat.columns:
        if mat.loc[user_id, cid] == 0:
            numerator = 0.0
            denominator = 0.0
            for u in neigh:
                similarity_score = sim.loc[user_id, u]
                neighbor_rating = mat.loc[u, cid]
                numerator += similarity_score * neighbor_rating
                denominator += abs(similarity_score)
            val = numerator / denominator if denominator > 0 else 0.0
            if val > 0:
                scores[cid] = val
    return scores


# ── 8) Fungsi Rekomendasi dari “Transisi Kunjungan” ─────────────────────────────────
def rec_visited(user_id, K=6):
    """
    Dari urutan cafe_telah_dikunjungi setiap user lain, bentuk transisi a→b,
    lalu untuk tiap a yang user_id kunjungi, kumpulkan b, hitung frekuensi,
    filter yang sudah dikunjungi, ambil K teratas.
    return: list of cafe_id
    """
    seq = [int(v["id_cafe"]) for v in fetch_visited(user_id) if isinstance(v, dict)]
    trans = defaultdict(list)
    for uid in fetch_all_user_ids():
        if uid == user_id:
            continue
        seq_u = [int(v["id_cafe"]) for v in fetch_visited(uid) if isinstance(v, dict)]
        for a, b in zip(seq_u, seq_u[1:]):
            trans[a].append(b)

    cands = []
    for a in seq:
        cands += trans.get(a, [])
    freq = pd.Series(cands).value_counts().index.tolist()
    return [c for c in freq if c not in seq][:K]


# ── 9) Gabung Composite + Sort by Rating ─────────────────────────────────────────────
def get_top6_composite(user_id):
    """
    1) Hitung skor menu-based untuk semua cid → get_menu_scores(user_id)
    2) Ambil K*2 kandidat teratas berdasarkan skor (urut descending)
    3) Ambil K*2 kandidat teratas berdasarkan rec_visited
    4) Gabungkan pool, filter yang sudah dikunjungi
    5) Dari pool → ambil detail nama, rating, alamat, lalu
       sort primary by menu_score descending, kemudian by rating descending
    6) Ambil 6 teratas
    Return: DataFrame kolom ['cafe_id','nama_kafe','alamat','rating','score']
    """
    # 9.1) Hitung semua skor menu-based
    menu_scores = get_menu_scores(user_id)
    # 9.2) Urutkan descending berdasarkan skor, ambil K*2
    top_menu = sorted(menu_scores, key=menu_scores.get, reverse=True)[:12]

    # 9.3) Ambil kandidat dari visited‐based
    top_visited = rec_visited(user_id, 12)

    # 9.4) Gabungkan pool sambil hilangkan duplikat
    pool = list(dict.fromkeys(top_menu + top_visited))

    # 9.5) Buang yang sudah user_id kunjungi
    visited_seq = [int(v["id_cafe"]) for v in fetch_visited(user_id) if isinstance(v, dict)]
    visited_set = set(visited_seq)
    pool = [cid for cid in pool if cid not in visited_set]

    # 9.6) Tarik detail (nama_kafe, alamat, rating) dan sertakan menu_score (0 jika tidak ada)
    rows = []
    for cid in pool:
        info = fetch_cafe(cid)
        if not isinstance(info, dict):
            continue
        nama = info.get("nama_kafe", "Unknown")
        alamat_val = info.get("alamat", "")  # <<— ambil alamat di sini
        try:
            rating_val = float(info.get("rating", 0))
        except:
            rating_val = 0.0
        score_val = menu_scores.get(cid, 0.0)
        rows.append({
            "cafe_id":   cid,
            "nama_kafe": nama,
            "alamat":    alamat_val,    # <<— tambahkan field alamat
            "rating":    rating_val,
            "score":     score_val
        })

    dfc = pd.DataFrame(rows)
    if dfc.empty:
        return dfc

    # 9.7) Sort descending by composite score, lalu by rating
    dfc_sorted = dfc.sort_values(["score", "rating"], ascending=[False, False])
    return dfc_sorted.head(6).reset_index(drop=True)


# ── 10) API Endpoint: Rekomendasi Composite untuk satu user ─────────────────────────
@app.route("/api/recommend/<int:user_id>", methods=["GET"])
def api_recommend(user_id):
    """
    GET /api/recommend/{user_id}
    Return: JSON { 
      "recommendations": [ 
         { "cafe_id":..., "nama_kafe":..., "alamat":..., "rating":..., "score":... }, 
         … 
      ] 
    }
    """
    try:
        # Pastikan user ada
        u = fetch_user(user_id)
        if not u or "error" in u:
            return jsonify({"error": "User not found"}), 404

        # Ambil top6 composite
        df_top6 = get_top6_composite(user_id)
        if df_top6.empty:
            return jsonify({"recommendations": []}), 200

        recs = df_top6.to_dict(orient="records")
        return jsonify({"recommendations": recs}), 200

    except requests.exceptions.HTTPError as e:
        return jsonify({"error": "Failed fetching data from upstream API", "details": str(e)}), 502
    except Exception as e:
        return jsonify({"error": "Internal server error", "details": str(e)}), 500


# ── 11) Evaluasi Next‐Item (leave‐one‐out) ──────────────────────────────────────────
def recommend_next(user_id, history, K=6):
    """
    Untuk evaluasi: prediksi item berikutnya berdasar transisi visited.
    """
    trans = defaultdict(list)
    for uid in fetch_all_user_ids():
        seq = [int(v["id_cafe"]) for v in fetch_visited(uid) if isinstance(v, dict)]
        for a, b in zip(seq, seq[1:]):
            trans[a].append(b)

    last = history[-1]
    freq = pd.Series(trans.get(last, [])).value_counts().index.tolist()
    return [c for c in freq if c not in history][:K]


def evaluate_next(K=6):
    """
    Hitung HitRate & MRR dengan leave‐one‐out:
    - history = semua visited kecuali terakhir, test = item terakhir
    - panggil recommend_next, hitung metrik
    """
    hits, mrrs = [], []
    for uid in fetch_all_user_ids():
        seq = [int(v["id_cafe"]) for v in fetch_visited(uid) if isinstance(v, dict)]
        if len(seq) < 2:
            continue
        hist, test = seq[:-1], seq[-1]
        recs = recommend_next(uid, hist, K)
        hits.append(1 if test in recs else 0)
        if test in recs:
            rank = recs.index(test) + 1
            mrrs.append(1.0 / rank)
        else:
            mrrs.append(0.0)

    return {
        "HitRate": np.mean(hits) if hits else 0.0,
        "MRR":     np.mean(mrrs) if mrrs else 0.0
    }


@app.route("/api/evaluate", methods=["GET"])
def api_evaluate():
    """
    GET /api/evaluate
    Return: { "HitRate": ..., "MRR": ... }
    """
    try:
        metrics = evaluate_next(K=6)
        return jsonify(metrics), 200
    except Exception as e:
        return jsonify({"error": "Evaluation failed", "details": str(e)}), 500


# ── 12) Jalankan Flask ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
