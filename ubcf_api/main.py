# main.py
from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import pandas as pd
import numpy as np
import json
from sklearn.neighbors import NearestNeighbors
from collections import defaultdict
import time
import math
import re
import itertools
import random
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

app = Flask(__name__)
CORS(app)

# -------------------------
# Config: sesuaikan BASE jika perlu
# -------------------------
BASE = "http://127.0.0.1:8080"  # backend yang menyediakan /api/users, /api/cafe/<id>, dsb.
DEFAULT_TIMEOUT = 6  # detik

# -------------------------
# Session global dengan pooling & retry
# -------------------------
session = requests.Session()
session.headers.update({"ngrok-skip-browser-warning": "true", "Connection": "keep-alive"})
retry_strategy = Retry(
    total=3,
    status_forcelist=[429, 500, 502, 503, 504],
    backoff_factor=0.25,
    allowed_methods=["GET", "POST"]
)
adapter = HTTPAdapter(pool_connections=100, pool_maxsize=100, max_retries=retry_strategy, pool_block=True)
session.mount("http://", adapter)
session.mount("https://", adapter)

# -------------------------
# Simple caches
# -------------------------
_cafe_cache = None
_sentiment_cache = {}
_SENT_CACHE_TTL = 60 * 60  # 1 hour

# -------------------------
# Utility: safe HTTP GET
# -------------------------
def safe_get(url, timeout=DEFAULT_TIMEOUT):
    try:
        r = session.get(url, timeout=timeout)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"[WARN] safe_get error for {url}: {e}")
        return None

# -------------------------
# Fetch helpers (use cache where possible)
# -------------------------
def fetch_all_user_ids():
    data = safe_get(f"{BASE}/api/users")
    if not data:
        return []
    ids = []
    for u in data:
        try:
            ids.append(int(u.get("id_user")))
        except:
            continue
    return ids

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

def fetch_reviews_raw(cid):
    data = safe_get(f"{BASE}/api/reviews/{cid}")
    return data or []

def fetch_all_cafes():
    """Ambil semua kafe sekali, hasil disimpan di cache."""
    global _cafe_cache
    if _cafe_cache is None:
        try:
            data = session.get(f"{BASE}/api/data", timeout=DEFAULT_TIMEOUT).json()
            d = {}
            for c in (data or []):
                key = c.get("nomor") or c.get("id_cafe") or None
                if key is not None:
                    try:
                        d[int(key)] = c
                    except:
                        pass
            _cafe_cache = d
        except Exception as e:
            print("[WARN] fetch_all_cafes failed:", e)
            _cafe_cache = {}
    return _cafe_cache

def fetch_cafe(cid):
    """Ambil data kafe dari cache jika ada, fallback ke API."""
    d = fetch_all_cafes()
    if d and cid in d:
        return d[cid]
    try:
        r = session.get(f"{BASE}/api/cafe/{cid}", timeout=DEFAULT_TIMEOUT)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"[WARN] fetch_cafe fallback error for {cid}: {e}")
        return {}

# -------------------------
# Sentiment helpers (cache + compute)
# -------------------------
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
    """
    Map reviews to score 0..1.
    - label-based: positive -> 1.0, neutral -> 0.5, negative -> 0.0
    - probability-based fields accepted: p_pos/p_neu/p_neg or prob_pos/prob_neu/prob_neg
    - Bayesian smoothing to avoid extremes when few reviews
    """
    if not reviews:
        return None
    scores = []
    for r in reviews:
        if not isinstance(r, dict):
            continue
        # probability-style
        p_pos = float(r.get("p_pos", r.get("prob_pos", 0.0) or 0.0))
        p_neu = float(r.get("p_neu", r.get("prob_neu", 0.0) or 0.0))
        p_neg = float(r.get("p_neg", r.get("prob_neg", 0.0) or 0.0))
        if (p_pos + p_neu + p_neg) > 0:
            s = p_pos * 1.0 + p_neu * 0.5 + p_neg * 0.0
            scores.append(s)
            continue
        # label-based
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
    # try cache first
    cached = _sent_cache_get(cid)
    if cached is not None:
        return cached
    # prefer sentiment endpoint if available
    try:
        data = safe_get(f"{BASE}/api/sentiment/{cid}")
        reviews = None
        if isinstance(data, list):
            reviews = data
        elif isinstance(data, dict):
            if "reviews" in data and isinstance(data["reviews"], list):
                reviews = data["reviews"]
            else:
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
    except Exception as e:
        # fallback to raw reviews
        try:
            raw = fetch_reviews_raw(cid)
            reviews = raw if isinstance(raw, list) else (raw.get("reviews") if isinstance(raw, dict) else None)
            score = compute_sentiment_score_from_reviews(reviews) if reviews is not None else None
            _sent_cache_set(cid, score)
            return score
        except Exception:
            _sent_cache_set(cid, None)
            return None

# -------------------------
# Collaborative Filtering (UBCF) and helpers
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
            if isinstance(m, dict) and "id_cafe" in m:
                try:
                    records.append({
                        "user_id": int(uid),
                        "cafe_id": int(m["id_cafe"]),
                        "harga": 1  # binary interaction for UBCF
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
    sim = pd.DataFrame(np.clip(sim_vals, -1, 1), index=mat.index, columns=mat.index)
    dist = 1 - sim
    try:
        knn = NearestNeighbors(metric="precomputed", n_neighbors=min(10, max(1, len(sim))))
        knn.fit(dist.values)
    except Exception:
        knn = None
    return mat, sim, knn

def rec_menu_scores(uid, mat, sim, knn):
    if knn is None or uid not in sim.index:
        return {}
    try:
        _, idxs = knn.kneighbors((1 - sim).loc[[uid]].values, n_neighbors=min(len(sim), 6))
    except Exception:
        return {}
    neigh = sim.index[idxs[0][1:]]
    scores = {}
    for cid in mat.columns:
        if mat.loc[uid, cid] == 0:
            num_ = sum(sim.loc[uid, v] * mat.loc[v, cid] for v in neigh)
            den_ = sum(abs(sim.loc[uid, v]) for v in neigh)
            val = num_ / den_ if den_ > 0 else 0.0
            if val > 0:
                scores[cid] = val
    return scores

def rec_visited_freq(uid):
    seq = [v["id_cafe"] for v in fetch_visited(uid) if isinstance(v, dict)]
    trans = defaultdict(list)
    for other in fetch_all_user_ids():
        if other == uid:
            continue
        seq2 = [v["id_cafe"] for v in fetch_visited(other) if isinstance(v, dict)]
        for a, b in zip(seq2, seq2[1:]):
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
    def norm_name(s):
        if not s: return ""
        s2 = s.strip().lower()
        s2 = re.sub(r'[^a-z0-9\s]', '', s2)
        s2 = re.sub(r'\s+', ' ', s2)
        return s2
    my_menus = {norm_name(m["nama_menu"]) for m in my_list if isinstance(m, dict) and m.get("nama_menu")}
    cooc = defaultdict(set)
    for other in fetch_all_user_ids():
        if other == uid:
            continue
        u2 = fetch_user(other)
        raw2 = u2.get("menu_yang_disukai") or "[]"
        try:
            favs2 = json.loads(raw2) if isinstance(raw2, str) else raw2
        except:
            favs2 = []
        for m in (favs2 if isinstance(favs2, list) else []):
            if not isinstance(m, dict):
                continue
            nm = norm_name(m.get("nama_menu", ""))
            if nm in my_menus:
                try:
                    cooc[int(m["id_cafe"])].add(nm)
                except:
                    continue
    return {cid: sorted(list(ms)) for cid, ms in cooc.items()}

# -------------------------
# Utility helpers (normalize / haversine)
# -------------------------
def haversine_meters(lat1, lon1, lat2, lon2):
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2.0)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2.0)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def robust_normalize_scores(scores_dict, pct=90):
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
# Recommendation endpoint
# -------------------------
@app.route("/api/recommend/<int:uid>")
def api_recommend(uid):
    mat, sim, knn = build_cf_model()
    cf_raw = rec_menu_scores(uid, mat, sim, knn)
    vf_raw = rec_visited_freq(uid)
    co_raw = rec_menu_cooccur(uid)

    # global popularity
    all_vf = {}
    for u in fetch_all_user_ids():
        try:
            vf_u = rec_visited_freq(u)
            for k, v in vf_u.items():
                all_vf[k] = all_vf.get(k, 0) + v
        except Exception:
            continue
    global_popular_list = [k for k, _ in sorted(all_vf.items(), key=lambda x:-x[1])]

    CF_THRESHOLD = 0.01
    pool = build_candidate_pool_from_signals(cf_raw, vf_raw, co_raw, global_popular_list, top_n_each=100)
    pool = [c for c in pool if (cf_raw.get(c, 0) >= CF_THRESHOLD) or (c in global_popular_list)]
    seen = {v["id_cafe"] for v in fetch_visited(uid) if isinstance(v, dict)}
    pool = [c for c in pool if c not in seen]
    if not pool:
        return jsonify({"recommendations": []})

    cf_norm = robust_normalize_scores(cf_raw, pct=90)
    vf_norm = robust_normalize_scores(vf_raw, pct=90)
    co_counts = {k: len(v) for k, v in co_raw.items()}
    co_norm = robust_normalize_scores(co_counts, pct=90)
    pop_vals = np.array(list(all_vf.values())) if all_vf else np.array([1])
    pct95_pop = np.percentile(pop_vals, 95) if len(pop_vals) > 0 else 1.0

    udata = fetch_user(uid) or {}
    user_lat = float(udata.get("last_lat")) if udata.get("last_lat") else None
    user_lng = float(udata.get("last_lng")) if udata.get("last_lng") else None
    pref_list = [p.strip().lower() for p in (udata.get("preferensi_fasilitas") or "").split(",") if p.strip()]

    w_cf = 0.45; w_vf = 0.15; w_co = 0.15; w_sent = 0.15; w_rating = 0.10

    cafes_cache = fetch_all_cafes()
    rows = []
    for cid in pool:
        info = cafes_cache.get(cid) or fetch_cafe(cid) or {}
        cf_s = cf_norm.get(cid, 0.0); vf_s = vf_norm.get(cid, 0.0); co_s = co_norm.get(cid, 0.0)
        rating_val = float(info.get("rating", 0.0)) if info.get("rating") is not None else 0.0
        rating_n = normalize_number(rating_val, cap=5.0)
        sent_score = compute_sentiment_for_cafe(cid)
        sent_n = float(sent_score) if sent_score is not None else 0.5
        popularity = all_vf.get(cid, 0)
        pop_n = normalize_popularity(popularity, pct95_pop)

        # small distance bonus if user coords available
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

        combined = (w_cf * cf_s + w_vf * vf_s + w_co * co_s + w_sent * sent_n + w_rating * rating_n)
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
# Internal evaluate utility (returns plain metrics)
# -------------------------
def evaluate_internal(last_n=1, users_list=None, K=6, weights=None, sample_size=None):
    users = users_list if users_list is not None else fetch_all_user_ids()
    if not users:
        return {"Precision": 0.0, "Recall": 0.0, "F1": 0.0, "nDCG": 0.0}
    if sample_size and sample_size < len(users):
        users = random.sample(users, sample_size)

    mat, sim, knn = build_cf_model()

    # precompute vf & co per user to avoid repeated fetches
    vf_by_user = {}
    co_by_user = {}
    for u in users:
        vf_by_user[u] = rec_visited_freq(u)
        co_by_user[u] = rec_menu_cooccur(u)

    all_vf = {}
    for u, vfmap in vf_by_user.items():
        for k, v in vfmap.items():
            all_vf[k] = all_vf.get(k, 0) + v
    global_popular_list = [k for k, _ in sorted(all_vf.items(), key=lambda x:-x[1])]
    pop_vals = np.array(list(all_vf.values())) if all_vf else np.array([1])
    pct95_pop = np.percentile(pop_vals, 95) if len(pop_vals) > 0 else 1.0

    if weights is None:
        w_cf = 0.45; w_vf = 0.15; w_co = 0.15; w_sent = 0.15; w_rating = 0.10
    else:
        w_cf = weights.get("w_cf", 0.45)
        w_vf = weights.get("w_vf", 0.15)
        w_co = weights.get("w_co", 0.15)
        w_sent = weights.get("w_sent", 0.15)
        w_rating = weights.get("w_rating", 0.10)

    precisions = []; recalls = []; f1s = []; ndcgs = []
    cafes_cache = fetch_all_cafes()

    for uid in users:
        seq_full = [v["id_cafe"] for v in fetch_visited(uid) if isinstance(v, dict)]
        if len(seq_full) < (last_n + 1):
            continue
        test_set = seq_full[-last_n:]
        seen_hist = set(seq_full[:-last_n])

        cf_raw = rec_menu_scores(uid, mat, sim, knn)
        vf_raw = vf_by_user.get(uid, {}) or {}
        co_raw = co_by_user.get(uid, {}) or {}

        pool = build_candidate_pool_from_signals(cf_raw, vf_raw, co_raw, global_popular_list, top_n_each=100)
        CF_THRESHOLD = 0.01
        pool = [c for c in pool if (cf_raw.get(c, 0) >= CF_THRESHOLD) or (c in global_popular_list)]
        pool = [c for c in pool if c not in seen_hist]
        if not pool:
            continue

        max_cf = max(cf_raw.values()) if cf_raw else 1.0
        max_vf = max(vf_raw.values()) if vf_raw else 1.0
        max_co = max((len(v) for v in co_raw.values()), default=1)

        scores = {}
        for cid in pool:
            cf_n = cf_raw.get(cid, 0) / max_cf if max_cf else 0.0
            vf_n = vf_raw.get(cid, 0) / max_vf if max_vf else 0.0
            co_n = len(co_raw.get(cid, [])) / max_co if max_co else 0.0

            info = cafes_cache.get(cid) or fetch_cafe(cid) or {}
            try:
                rating_val = float(info.get("rating", 0.0))
            except:
                rating_val = 0.0
            rating_n = max(0.0, min(1.0, rating_val / 5.0))
            sent = compute_sentiment_for_cafe(cid)
            sent_n = float(sent) if sent is not None else 0.5

            scores[cid] = (w_cf * cf_n + w_vf * vf_n + w_co * co_n + w_sent * sent_n + w_rating * rating_n)

        ranked = sorted(scores, key=lambda x: -scores[x])[:K]

        hits = sum(1 for c in ranked if c in test_set)
        precision_u = hits / float(K)
        recall_u = hits / float(len(test_set)) if len(test_set) > 0 else 0.0
        f1_u = (2 * precision_u * recall_u / (precision_u + recall_u)) if (precision_u + recall_u) > 0 else 0.0
        precisions.append(precision_u); recalls.append(recall_u); f1s.append(f1_u)

        dcg = 0.0
        for i, cid in enumerate(ranked, start=1):
            rel = 1 if cid in test_set else 0
            dcg += (2**rel - 1) / np.log2(i + 1)
        R = min(len(test_set), K)
        idcg = sum((2**1 - 1) / np.log2(i + 1) for i in range(1, R+1)) if R>0 else 1.0
        ndcgs.append(dcg / idcg if idcg > 0 else 0.0)

    precision_k = float(np.mean(precisions)) if precisions else 0.0
    recall_k = float(np.mean(recalls)) if recalls else 0.0
    f1_k = float(np.mean(f1s)) if f1s else 0.0
    ndcg_k = float(np.mean(ndcgs)) if ndcgs else 0.0

    return {
        "Precision": round(precision_k, 4),
        "Recall": round(recall_k, 4),
        "F1": round(f1_k, 4),
        "nDCG": round(ndcg_k, 4)
    }

# -------------------------
# Evaluate endpoint (supports last_n, K, sample_size)
# -------------------------
@app.route("/api/evaluate")
def api_evaluate():
    try:
        last_n = int(request.args.get("last_n", 1))
        sample_size = request.args.get("sample_size", None)
        sample_size = int(sample_size) if sample_size else None
        K = int(request.args.get("K", 6))
    except Exception:
        last_n = 1; sample_size = None; K = 6

    res = evaluate_internal(last_n=last_n, users_list=None, K=K, weights=None, sample_size=sample_size)
    return jsonify({
        f"Precision@{K}": res["Precision"],
        f"Recall@{K}": res["Recall"],
        f"F1@{K}": res["F1"],
        f"nDCG@{K}": res["nDCG"]
    })

# -------------------------
# Gridsearch endpoint (precompute heavy parts once)
# -------------------------
@app.route("/api/gridsearch", methods=["POST"])
def api_gridsearch():
    payload = request.get_json() or {}
    w_cf_list = payload.get("w_cf", [0.35, 0.45, 0.55])
    w_vf_list = payload.get("w_vf", [0.1, 0.15])
    w_co_list = payload.get("w_co", [0.1, 0.15])
    w_sent_list = payload.get("w_sent", [0.05, 0.15, 0.25])
    w_rating_list = payload.get("w_rating", [0.0, 0.05, 0.1])
    K = int(payload.get("K", 6))
    last_n = int(payload.get("last_n", 1))
    sample_size = payload.get("sample_size", None)
    sample_size = int(sample_size) if sample_size else None
    max_combinations = int(payload.get("max_combinations", 200))

    combos = []
    for combo in itertools.product(w_cf_list, w_vf_list, w_co_list, w_sent_list, w_rating_list):
        s = sum(combo)
        if s <= 0:
            continue
        norm = tuple(float(x)/s for x in combo)
        combos.append({
            "w_cf": norm[0],
            "w_vf": norm[1],
            "w_co": norm[2],
            "w_sent": norm[3],
            "w_rating": norm[4]
        })
    seen = set(); unique_combos = []
    for c in combos:
        key = (round(c["w_cf"],4), round(c["w_vf"],4), round(c["w_co"],4), round(c["w_sent"],4), round(c["w_rating"],4))
        if key not in seen:
            seen.add(key); unique_combos.append(c)
    if len(unique_combos) > max_combinations:
        unique_combos = unique_combos[:max_combinations]

    users_all = fetch_all_user_ids()
    if not users_all:
        return jsonify({"error": "No users found"}), 400
    users_list_for_eval = users_all if not sample_size else random.sample(users_all, min(len(users_all), sample_size))

    # precompute common heavy artifacts
    mat, sim, knn = build_cf_model()
    vf_by_user = {u: rec_visited_freq(u) for u in users_list_for_eval}
    co_by_user = {u: rec_menu_cooccur(u) for u in users_list_for_eval}
    all_vf = {}
    for u, vfmap in vf_by_user.items():
        for k, v in vfmap.items():
            all_vf[k] = all_vf.get(k, 0) + v
    global_popular_list = [k for k, _ in sorted(all_vf.items(), key=lambda x:-x[1])]
    pop_vals = np.array(list(all_vf.values())) if all_vf else np.array([1])
    pct95_pop = np.percentile(pop_vals, 95) if len(pop_vals) > 0 else 1.0
    visited_by_user = {}
    for u in users_list_for_eval:
        seq = [v["id_cafe"] for v in fetch_visited(u) if isinstance(v, dict)]
        visited_by_user[u] = seq
    pool_by_user = {}
    CF_THRESHOLD = 0.01
    for u in users_list_for_eval:
        cf_raw = rec_menu_scores(u, mat, sim, knn)
        vf_raw = vf_by_user.get(u, {}) or {}
        co_raw = co_by_user.get(u, {}) or {}
        pool = build_candidate_pool_from_signals(cf_raw, vf_raw, co_raw, global_popular_list, top_n_each=100)
        pool = [c for c in pool if (cf_raw.get(c, 0) >= CF_THRESHOLD) or (c in global_popular_list)]
        prev_seen = set(visited_by_user[u][:-last_n] if len(visited_by_user[u])>last_n else [])
        pool = [c for c in pool if c not in prev_seen]
        pool_by_user[u] = pool

    cafes_cache = fetch_all_cafes()
    results = []
    for c in unique_combos:
        w_cf = c["w_cf"]; w_vf = c["w_vf"]; w_co = c["w_co"]; w_sent = c["w_sent"]; w_rating = c["w_rating"]
        precisions = []; recalls = []; f1s = []; ndcgs = []
        for uid in users_list_for_eval:
            seq_full = visited_by_user.get(uid, [])
            if len(seq_full) < (last_n + 1):
                continue
            test_set = seq_full[-last_n:]
            cf_raw = rec_menu_scores(uid, mat, sim, knn)
            vf_raw = vf_by_user.get(uid, {}) or {}
            co_raw = co_by_user.get(uid, {}) or {}
            pool = pool_by_user.get(uid, []) or []
            if not pool:
                continue
            max_cf = max(cf_raw.values()) if cf_raw else 1.0
            max_vf = max(vf_raw.values()) if vf_raw else 1.0
            max_co = max((len(v) for v in co_raw.values()), default=1)
            scores = {}
            for cid in pool:
                cf_n = cf_raw.get(cid, 0) / max_cf if max_cf else 0.0
                vf_n = vf_raw.get(cid, 0) / max_vf if max_vf else 0.0
                co_n = len(co_raw.get(cid, [])) / max_co if max_co else 0.0
                info = cafes_cache.get(cid) or fetch_cafe(cid) or {}
                try:
                    rating_val = float(info.get("rating", 0.0))
                except:
                    rating_val = 0.0
                rating_n = max(0.0, min(1.0, rating_val / 5.0))
                sent = compute_sentiment_for_cafe(cid)
                sent_n = float(sent) if sent is not None else 0.5
                scores[cid] = (w_cf * cf_n + w_vf * vf_n + w_co * co_n + w_sent * sent_n + w_rating * rating_n)
            ranked = sorted(scores, key=lambda x: -scores[x])[:K]
            hits = sum(1 for ccc in ranked if ccc in test_set)
            precision_u = hits / float(K)
            recall_u = hits / float(len(test_set)) if len(test_set)>0 else 0.0
            f1_u = (2 * precision_u * recall_u / (precision_u + recall_u)) if (precision_u + recall_u) > 0 else 0.0
            precisions.append(precision_u); recalls.append(recall_u); f1s.append(f1_u)
            dcg = 0.0
            for i, cid in enumerate(ranked, start=1):
                rel = 1 if cid in test_set else 0
                dcg += (2**rel - 1) / np.log2(i + 1)
            R = min(len(test_set), K)
            idcg = sum((2**1 - 1) / np.log2(i + 1) for i in range(1, R+1)) if R>0 else 1.0
            ndcgs.append(dcg / idcg if idcg > 0 else 0.0)
        metrics = {
            "Precision": round(float(np.mean(precisions)) if precisions else 0.0, 4),
            "Recall": round(float(np.mean(recalls)) if recalls else 0.0, 4),
            "F1": round(float(np.mean(f1s)) if f1s else 0.0, 4),
            "nDCG": round(float(np.mean(ndcgs)) if ndcgs else 0.0, 4)
        }
        results.append({"weights": c, "metrics": metrics})

    results_sorted = sorted(results, key=lambda x: x["metrics"]["F1"], reverse=True)
    best = results_sorted[0] if results_sorted else None
    return jsonify({"best": best, "top": results_sorted[:10], "tried_count": len(results_sorted)})

# -------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
