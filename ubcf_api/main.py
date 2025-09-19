# main.py
from flask import Flask, jsonify
from flask_cors import CORS
import requests
import pandas as pd
import numpy as np
import json
from sklearn.neighbors import NearestNeighbors
from collections import defaultdict
import time
import math

app = Flask(__name__)
CORS(app)

# base backend serving cafe/user/review APIs (pastikan backend Anda berjalan di sini)
BASE = "http://127.0.0.1:8080"
# gunakan session dengan timeout default di tiap request
session = requests.Session()
session.headers.update({"ngrok-skip-browser-warning": "true"})
DEFAULT_TIMEOUT = 6  # detik

# -------------------------
# Helper: fetch wrappers (dengan timeout & error handling)
# -------------------------
def safe_get(url, timeout=DEFAULT_TIMEOUT):
    try:
        r = session.get(url, timeout=timeout)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        # print log singkat; jangan crash server
        print(f"[WARN] safe_get error for {url}: {e}")
        return None

def fetch_all_user_ids():
    data = safe_get(f"{BASE}/api/users")
    if not data:
        return []
    try:
        return [int(u["id_user"]) for u in data if "id_user" in u]
    except Exception:
        return []

def fetch_user(uid):
    data = safe_get(f"{BASE}/api/users/{uid}")
    return data or {}

def fetch_visited(uid):
    data = safe_get(f"{BASE}/api/visited/{uid}")
    if data is None:
        return []
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "visited_cafes" in data:
        return data["visited_cafes"]
    return data

def fetch_cafe(cid):
    data = safe_get(f"{BASE}/api/cafe/{cid}")
    return data or {}

def fetch_reviews_raw(cid):
    data = safe_get(f"{BASE}/api/reviews/{cid}")
    return data or []

# -------------------------
# Sentiment helpers (cache + compute)
# -------------------------
_sentiment_cache = {}
_SENT_CACHE_TTL = 60 * 60  # 1 hour TTL seconds

def _sent_cache_get(cid):
    ent = _sentiment_cache.get(cid)
    if not ent:
        return None
    ts, val = ent
    if time.time() - ts > _SENT_CACHE_TTL:
        _sentiment_cache.pop(cid, None)
        return None
    return val

def _sent_cache_set(cid, value):
    _sentiment_cache[cid] = (time.time(), value)

def compute_sentiment_score_from_reviews(reviews):
    if not reviews:
        return None
    scores = []
    for r in reviews:
        if not isinstance(r, dict):
            continue
        # probability-based
        p_pos = float(r.get("p_pos", r.get("prob_pos", 0.0)))
        p_neu = float(r.get("p_neu", r.get("prob_neu", 0.0)))
        p_neg = float(r.get("p_neg", r.get("prob_neg", 0.0)))
        if p_pos or p_neu or p_neg:
            s = p_pos * 1.0 + p_neu * 0.5 + p_neg * 0.0
            scores.append(s)
            continue
        lab = (r.get("sentiment") or r.get("label") or "").strip().lower()
        if lab:
            if lab.startswith("pos"):
                scores.append(1.0)
            elif lab.startswith("neg"):
                scores.append(0.0)
            else:
                scores.append(0.5)
    if not scores:
        return None
    raw_mean = float(sum(scores)) / len(scores)
    prior = 0.6
    prior_count = 5.0
    n = len(scores)
    smoothed = (raw_mean * n + prior * prior_count) / (n + prior_count)
    return float(max(0.0, min(1.0, smoothed)))

def compute_sentiment_for_cafe(cid):
    cached = _sent_cache_get(cid)
    if cached is not None:
        return cached
    # coba endpoint /api/sentiment
    data = safe_get(f"{BASE}/api/sentiment/{cid}")
    reviews = None
    if isinstance(data, list):
        reviews = data
    elif isinstance(data, dict):
        if "reviews" in data and isinstance(data["reviews"], list):
            reviews = data["reviews"]
        else:
            # ambil semua list di dict jika ada
            arr = []
            for v in data.values():
                if isinstance(v, list):
                    arr.extend(v)
            if arr:
                reviews = arr
    if reviews is None:
        raw = fetch_reviews_raw(cid)
        if isinstance(raw, list):
            reviews = raw
        elif isinstance(raw, dict) and "reviews" in raw and isinstance(raw["reviews"], list):
            reviews = raw["reviews"]
        else:
            reviews = None
    score = compute_sentiment_score_from_reviews(reviews) if reviews is not None else None
    _sent_cache_set(cid, score)
    return score

# -------------------------
# Collaborative filtering & helpers (UBCF) - tetap dipertahankan
# -------------------------
def build_cf_model():
    records = []
    user_ids = fetch_all_user_ids()
    for uid in user_ids:
        u = fetch_user(uid)
        raw = u.get("menu_yang_disukai") or "[]"
        try:
            favs = json.loads(raw) if isinstance(raw, str) else raw
        except:
            favs = []
        for m in (favs if isinstance(favs, list) else []):
            if isinstance(m, dict) and "id_cafe" in m and "harga" in m:
                try:
                    records.append({
                        "user_id": uid,
                        "cafe_id": int(m["id_cafe"]),
                        "harga":   int(str(m["harga"]).replace(".", ""))
                    })
                except:
                    pass
    df = pd.DataFrame(records)
    if df.empty:
        return pd.DataFrame(), pd.DataFrame(), None
    mat = df.pivot_table(index="user_id", columns="cafe_id", values="harga", fill_value=0)
    X = mat.sub(mat.mean(axis=1), axis=0)
    num  = X.dot(X.T)
    norm = np.sqrt((X**2).sum(axis=1))
    den  = np.outer(norm, norm) + 1e-8
    sim_vals = np.divide(num.values, den, out=np.zeros_like(num.values), where=den>0)
    sim  = pd.DataFrame(np.clip(sim_vals, -1,1), index=mat.index, columns=mat.index)
    dist = 1 - sim
    knn  = NearestNeighbors(metric="precomputed", n_neighbors=min(5, len(sim)))
    knn.fit(dist.values)
    return mat, sim, knn

def rec_menu_scores(uid, mat, sim, knn):
    if knn is None or uid not in sim.index:
        return {}
    _, idxs = knn.kneighbors((1-sim).loc[[uid]].values, n_neighbors=min(len(sim), 10))
    neigh = sim.index[idxs[0][1:]]
    scores = {}
    for cid in mat.columns:
        if mat.loc[uid, cid] == 0:
            num_ = sum(sim.loc[uid, v]*mat.loc[v, cid] for v in neigh)
            den_ = sum(abs(sim.loc[uid, v]) for v in neigh)
            val = num_/den_ if den_>0 else 0.0
            if val > 0:
                scores[cid] = val
    return scores

def rec_visited_freq(uid):
    seq = [v["id_cafe"] for v in fetch_visited(uid) if isinstance(v, dict)]
    trans = defaultdict(list)
    # note: this function will be precomputed in evaluate to avoid heavy calls
    for other in fetch_all_user_ids():
        if other == uid: continue
        seq2 = [v["id_cafe"] for v in fetch_visited(other) if isinstance(v, dict)]
        for a,b in zip(seq2, seq2[1:]):
            trans[a].append(b)
    flat = sum((trans[a] for a in seq), [])
    return pd.Series(flat).value_counts().to_dict() if flat else {}

def rec_menu_cooccur(uid):
    me = fetch_user(uid)
    raw = me.get("menu_yang_disukai") or "[]"
    try:
        my_list = json.loads(raw) if isinstance(raw, str) else raw
    except:
        my_list = []
    my_menus = {m["nama_menu"] for m in my_list if isinstance(m, dict)}
    cooc = defaultdict(set)
    for other in fetch_all_user_ids():
        if other == uid: continue
        u2 = fetch_user(other)
        raw2 = u2.get("menu_yang_disukai") or "[]"
        try:
            favs2 = json.loads(raw2) if isinstance(raw2, str) else raw2
        except:
            favs2 = []
        for m in (favs2 if isinstance(favs2, list) else []):
            if not isinstance(m, dict): continue
            if m["nama_menu"] in my_menus:
                cooc[int(m["id_cafe"])].add(m["nama_menu"])
    return {cid: sorted(list(ms)) for cid,ms in cooc.items()}

# -------------------------
# Utility helpers for two-stage & features
# -------------------------
def haversine_meters(lat1, lon1, lat2, lon2):
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2.0)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2.0)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def robust_normalize_scores(scores_dict, pct=95):
    if not scores_dict:
        return {}
    vals = np.array(list(scores_dict.values()), dtype=float)
    if np.allclose(vals, 0):
        return {k: 0.0 for k in scores_dict}
    denom = np.percentile(vals, pct)
    denom = float(denom) if denom > 0 else float(vals.max() or 1.0)
    return {k: min(1.0, float(v) / denom) for k, v in scores_dict.items()}

def normalize_number(x, cap=1.0):
    if x is None:
        return 0.0
    try:
        xv = float(x)
    except:
        return 0.0
    return max(0.0, min(1.0, xv / cap))

def normalize_popularity(count, pct95_pop):
    if count is None:
        return 0.0
    denom = max(1.0, pct95_pop)
    return min(1.0, float(count) / denom)

def build_candidate_pool_from_signals(cf_raw, vf_raw, co_raw, global_popular_list, top_n_each=100):
    pool = set()
    pool.update(sorted(cf_raw.keys(), key=lambda k: -cf_raw.get(k, 0))[:top_n_each])
    pool.update(sorted(vf_raw.keys(), key=lambda k: -vf_raw.get(k, 0))[:top_n_each])
    pool.update(sorted(co_raw.keys(), key=lambda k: -len(co_raw.get(k, [])))[:top_n_each])
    pool.update(global_popular_list[:top_n_each])
    return list(pool)

# -------------------------
# API: recommend (two-stage + re-rank) — UBCF retained
#     IMPORTANT CHANGE: jika user belum punya visited history => langsung return []
# -------------------------
@app.route("/api/recommend/<int:uid>")
def api_recommend(uid):
    # cek visited history lebih dulu (early return)
    visited_list = fetch_visited(uid)
    if not visited_list or len(visited_list) == 0:
        # user belum punya histori, sesuai permintaan: jangan berikan rekomendasi
        return jsonify({"recommendations": []})

    # baru setelah kita tahu user punya histori, lakukan pemrosesan yang lebih berat
    mat, sim, knn = build_cf_model()
    cf_raw = rec_menu_scores(uid, mat, sim, knn)
    # precompute user's VF & CO for this user
    vf_raw = rec_visited_freq(uid)
    co_raw = rec_menu_cooccur(uid)

    # compute simple global popularity (aggregate visited freq across users) — compute once here
    all_vf = {}
    users = fetch_all_user_ids()
    for u in users:
        try:
            vf_u = rec_visited_freq(u)
            for k, v in vf_u.items():
                all_vf[k] = all_vf.get(k, 0) + v
        except Exception:
            continue
    global_popular_list = [k for k, _ in sorted(all_vf.items(), key=lambda x:-x[1])]

    pool = build_candidate_pool_from_signals(cf_raw, vf_raw, co_raw, global_popular_list, top_n_each=150)
    seen = {v["id_cafe"] for v in visited_list if isinstance(v, dict)}
    pool = [c for c in pool if c not in seen]
    if not pool:
        return jsonify({"recommendations": []})

    cf_norm = robust_normalize_scores(cf_raw, pct=95)
    vf_norm = robust_normalize_scores(vf_raw, pct=95)
    co_counts = {k: len(v) for k, v in co_raw.items()}
    co_norm = robust_normalize_scores(co_counts, pct=95)
    pop_vals = np.array(list(all_vf.values())) if all_vf else np.array([1])
    pct95_pop = np.percentile(pop_vals, 95) if len(pop_vals) > 0 else 1.0

    # optional: try read user's stored location
    udata = fetch_user(uid) or {}
    user_lat = float(udata.get("last_lat")) if udata.get("last_lat") else None
    user_lng = float(udata.get("last_lng")) if udata.get("last_lng") else None
    pref_list = [p.strip().lower() for p in (udata.get("preferensi_fasilitas") or "").split(",") if p.strip()]

    # --- weights baru sesuai permintaan ---
    # ubcf : 0.5, w_vf : 0.2, w_co : 0.2, w_sent_and_rate : 0.1
    w_cf = 0.5
    w_vf = 0.2
    w_co = 0.2
    w_sent_and_rate = 0.1
    # ------------------------------------------------

    rows = []
    for cid in pool:
        info = fetch_cafe(cid) or {}
        cf_s = cf_norm.get(cid, 0.0); vf_s = vf_norm.get(cid, 0.0); co_s = co_norm.get(cid, 0.0)
        rating_val = float(info.get("rating", 0.0)) if info.get("rating") is not None else 0.0
        rating_n = normalize_number(rating_val, cap=5.0)
        sent_score = compute_sentiment_for_cafe(cid)
        sent_n = float(sent_score) if sent_score is not None else 0.5
        # gabungkan sent dan rating dengan rata-rata (keduanya sudah 0..1)
        sent_and_rate = (sent_n + rating_n) / 2.0

        popularity = all_vf.get(cid, 0)
        pop_n = normalize_popularity(popularity, pct95_pop)

        dist_score = 0.0
        try:
            if user_lat is not None and user_lng is not None and info.get("latitude") and info.get("longitude"):
                dist_m = haversine_meters(user_lat, user_lng, float(info["latitude"]), float(info["longitude"]))
                dist_km = dist_m / 1000.0
                dist_score = 1.0 / (1.0 + dist_km)
        except:
            dist_score = 0.0

        cafe_facs = (info.get("fasilitas") or "").lower()
        fac_match_count = sum(1 for p in pref_list if p and p in cafe_facs)
        fac_score = min(1.0, fac_match_count / 3.0)

        # combined sekarang menggunakan grup sent+rating
        combined = (w_cf * cf_s + w_vf * vf_s + w_co * co_s + w_sent_and_rate * sent_and_rate)
        # tambahan bonus kecil seperti sebelumnya
        combined += 0.05 * dist_score + 0.03 * pop_n + 0.02 * fac_score

        rows.append({
            "cafe_id": cid,
            "nama_kafe": info.get("nama_kafe", ""),
            "alamat": info.get("alamat", ""),
            "rating": rating_val,
            "sentiment": round(sent_n, 4),
            "score": round(float(combined), 6),
            "matched_menu": co_raw.get(cid, [])
        })

    dfc = pd.DataFrame(rows)
    if dfc.empty:
        return jsonify({"recommendations": []})
    top6 = dfc.sort_values("score", ascending=False).head(6)
    return jsonify({"recommendations": top6.to_dict("records")})

# -------------------------
# API: evaluate (precompute caches — fixed performance)
# -------------------------
@app.route("/api/evaluate")
def api_evaluate():
    # Build global objects once
    users = fetch_all_user_ids()
    if not users:
        return jsonify({"error": "No users found"}), 400

    mat, sim, knn = build_cf_model()

    # Precompute VF and CO for all users once (cache)
    vf_by_user = {}
    co_by_user = {}
    for u in users:
        try:
            vf_by_user[u] = rec_visited_freq(u)
        except Exception:
            vf_by_user[u] = {}
        try:
            co_by_user[u] = rec_menu_cooccur(u)
        except Exception:
            co_by_user[u] = {}

    # Global popularity aggregation once
    all_vf = {}
    for u, vfmap in vf_by_user.items():
        for k, v in vfmap.items():
            all_vf[k] = all_vf.get(k, 0) + v
    global_popular_list = [k for k, _ in sorted(all_vf.items(), key=lambda x:-x[1])]
    pop_vals = np.array(list(all_vf.values())) if all_vf else np.array([1])
    pct95_pop = np.percentile(pop_vals, 95) if len(pop_vals) > 0 else 1.0

    # parameters
    K = 10
    # gunakan bobot yang sama seperti di recommend: ubcf 0.5, vf 0.2, co 0.2, sent+rate 0.1
    w_cf = 0.5
    w_vf = 0.2
    w_co = 0.2
    w_sent_and_rate = 0.1

    precisions = []
    recalls = []
    f1s = []
    ndcgs = []

    for uid in users:
        # user's visited sequence
        seq = [v["id_cafe"] for v in fetch_visited(uid) if isinstance(v, dict)]
        if len(seq) < 2:
            continue
        test_cafe = seq[-1]
        seen_hist = set(seq[:-1])

        # signals for user (from cache)
        cf_raw = rec_menu_scores(uid, mat, sim, knn)
        vf_raw = vf_by_user.get(uid, {}) or {}
        co_raw = co_by_user.get(uid, {}) or {}

        # build pool once per user using precomputed global_popular_list
        pool = build_candidate_pool_from_signals(cf_raw, vf_raw, co_raw, global_popular_list, top_n_each=150)
        pool = [c for c in pool if c not in seen_hist]
        if not pool:
            # cannot evaluate this user
            continue

        # compute normalizers per user
        max_cf = max(cf_raw.values()) if cf_raw else 1.0
        max_vf = max(vf_raw.values()) if vf_raw else 1.0
        max_co = max((len(v) for v in co_raw.values()), default=1)

        # compute scores for pool
        scores = {}
        for cid in pool:
            cf_n = cf_raw.get(cid, 0) / max_cf if max_cf else 0.0
            vf_n = vf_raw.get(cid, 0) / max_vf if max_vf else 0.0
            co_n = len(co_raw.get(cid, [])) / max_co if max_co else 0.0

            info = fetch_cafe(cid) or {}
            try:
                rating_val = float(info.get("rating", 0.0))
            except:
                rating_val = 0.0
            rating_n = max(0.0, min(1.0, rating_val / 5.0))
            sent = compute_sentiment_for_cafe(cid)
            sent_n = float(sent) if sent is not None else 0.5

            # gabungkan sent + rating
            sent_and_rate = (sent_n + rating_n) / 2.0

            scores[cid] = (w_cf * cf_n + w_vf * vf_n + w_co * co_n + w_sent_and_rate * sent_and_rate)

        # ranking top-K
        ranked = sorted(scores, key=lambda x: -scores[x])[:K]

        # metrics (leave-one-out test, you may change to multi-item ground-truth)
        hits = 1 if test_cafe in ranked else 0
        precision_u = hits / float(K)
        recall_u = hits / 1.0
        f1_u = (2 * precision_u * recall_u / (precision_u + recall_u)) if (precision_u + recall_u) > 0 else 0.0
        precisions.append(precision_u); recalls.append(recall_u); f1s.append(f1_u)

        # nDCG
        dcg = 0.0
        for i, cid in enumerate(ranked, start=1):
            rel = 1 if cid == test_cafe else 0
            dcg += (2**rel - 1) / np.log2(i + 1)
        idcg = (2**1 - 1) / np.log2(1 + 1)
        ndcgs.append(dcg / idcg if idcg > 0 else 0.0)

    precision_k = float(np.mean(precisions)) if precisions else 0.0
    recall_k = float(np.mean(recalls)) if recalls else 0.0
    f1_k = float(np.mean(f1s)) if f1s else 0.0
    ndcg_k = float(np.mean(ndcgs)) if ndcgs else 0.0

    return jsonify({
        "Precision@{}".format(K): round(precision_k, 4),
        "Recall@{}".format(K): round(recall_k, 4),
        "F1@{}".format(K): round(f1_k, 4),
        "nDCG@{}".format(K): round(ndcg_k, 4)
    })

# -------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
