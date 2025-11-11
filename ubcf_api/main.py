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
import random

app = Flask(__name__)
CORS(app)

BASE = "http://127.0.0.1:8080"
BASE = BASE.rstrip("/")

session = requests.Session()
DEFAULT_TIMEOUT = 6 

CACHE_TTL = 2 
_cafes_cache = {"ts": 0, "data": None}
_users_cache = {"ts": 0, "data": None}

def now_ts():
    return time.time()

def invalidate_caches(clear_sentiment=False):
    _cafes_cache["data"] = None
    _cafes_cache["ts"] = 0
    _users_cache["data"] = None
    _users_cache["ts"] = 0
    if clear_sentiment:
        _sentiment_cache.clear()

def safe_get(url, timeout=DEFAULT_TIMEOUT):
    try:
        r = session.get(url, timeout=timeout)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.RequestException as e:
        print(f"Error saat mengambil data dari {url}: {e}")
        return None
    except json.JSONDecodeError:
        print(f"Error: Respons dari {url} bukan JSON valid.")
        return None

# FETCH DATA dari API
def fetch_all_cafes(force=False):
    if not force and _cafes_cache["data"] is not None and (now_ts() - _cafes_cache["ts"] < CACHE_TTL):
        return _cafes_cache["data"]
    data = safe_get(f"{BASE}/api/data")
    if isinstance(data, list):
        _cafes_cache["data"] = data
        _cafes_cache["ts"] = now_ts()
        return data
    return _cafes_cache["data"] or []

def fetch_all_users(force=False):
    if not force and _users_cache["data"] is not None and (now_ts() - _users_cache["ts"] < CACHE_TTL):
        return _users_cache["data"]
    data = safe_get(f"{BASE}/api/users")
    if isinstance(data, list):
        _users_cache["data"] = data
        _users_cache["ts"] = now_ts()
        return data
    return _users_cache["data"] or []

def fetch_cafe(cid):
    cafes = fetch_all_cafes()
    if cafes:
        for c in cafes:
            try:
                if int(c.get("nomor", c.get("id_cafe", c.get("id", -999)))) == int(cid):
                    return c
            except (ValueError, TypeError):
                continue
    data = safe_get(f"{BASE}/api/cafe/{cid}")
    return data or {}

def fetch_user(uid):
    users = fetch_all_users()
    if users:
        for u in users:
            try:
                if int(u.get("id_user", u.get("id", -999))) == int(uid):
                    return u
            except (ValueError, TypeError):
                continue
    data = safe_get(f"{BASE}/api/users/{uid}")
    return data or {}

def fetch_visited(uid):
    u = fetch_user(uid)
    if not u:
        return []
    raw = u.get("cafe_telah_dikunjungi") or u.get("cafe_telah_dikunjungi", "[]")
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return parsed
        except json.JSONDecodeError:
            return []
    return []

# normalisasi list kafe yanng dikunjungi pengguna target
def _normalize_visited_list(raw_vis):
    out = []
    if raw_vis is None:
        return out

    items = []
    if isinstance(raw_vis, list):
        items = raw_vis
    elif isinstance(raw_vis, str):
        try:
            parsed = json.loads(raw_vis)
            if isinstance(parsed, list):
                items = parsed
        except json.JSONDecodeError:
            pass

    for it in items:
        if isinstance(it, dict):
            for k in ("id_cafe", "nomor", "cafe_id", "id"):
                if k in it and it[k] not in (None, ""):
                    try:
                        out.append(int(it[k]))
                        break
                    except (ValueError, TypeError):
                        pass
        else:
            try:
                out.append(int(it))
            except (ValueError, TypeError):
                pass
    return out

# ekstraksi sinyal dari riwayat kunjungan pengguna
def rec_visited_freq(uid):
    users = fetch_all_users()
    if not users:
        return {}

    # Riwayat kunjungan pengguna target
    my_seq = []
    for u in users:
        try:
            u_id = int(u.get("id_user", u.get("id", -1)))
            if u_id == int(uid):
                raw = u.get("cafe_telah_dikunjungi") or u.get("visited") or "[]"
                my_seq = _normalize_visited_list(raw)
                break
        except (ValueError, TypeError):
            continue

    if not my_seq:
        try:
            raw2 = fetch_visited(uid)
            my_seq = _normalize_visited_list(raw2)
        except Exception:
            my_seq = []

    if not my_seq:
        return {}

    # Peta transisi A->B dari pengguna lain
    trans = defaultdict(list)
    for other in users:
        try:
            other_id = int(other.get("id_user", other.get("id", -1)))
            if other_id == int(uid):
                continue
        except (ValueError, TypeError):
            continue

        raw_other = other.get("cafe_telah_dikunjungi") or other.get("visited") or "[]"
        seq2 = _normalize_visited_list(raw_other)
        for a, b in zip(seq2, seq2[1:]):
            try:
                trans[int(a)].append(int(b))
            except (ValueError, TypeError):
                continue

    # hitung frekuensi kemunculan di transisi
    flat = []
    for a in my_seq:
        try:
            flat.extend(trans.get(int(a), []))
        except (ValueError, TypeError):
            continue

    if not flat:
        return {}

    counts = {}
    for v in flat:
        counts[v] = counts.get(v, 0) + 1
    return counts

# ekstraksi sinyal dari menu yang disukai pengguna
def rec_menu_cooccur(uid):
    users = fetch_all_users()

    me = next((u for u in users if str(u.get("id_user", u.get("id", -1))) == str(uid)), {})
    if not me:
        me = fetch_user(uid)
    if not me:
        return {}

    raw = me.get("menu_yang_disukai") or "[]"
    try:
        my_list = json.loads(raw) if isinstance(raw, str) else raw
    except json.JSONDecodeError:
        my_list = []

    my_menus = {m["nama_menu"] for m in my_list if isinstance(m, dict) and "nama_menu" in m}
    if not my_menus:
        return {}

    cooc = defaultdict(set)
    for other in users:
        try:
            other_id = other.get("id_user") or other.get("id")
            if other_id is None or str(other_id) == str(uid):
                continue
        except Exception:
            continue

        raw2 = other.get("menu_yang_disukai") or "[]"
        try:
            favs2 = json.loads(raw2) if isinstance(raw2, str) else raw2
        except json.JSONDecodeError:
            favs2 = []

        for m in (favs2 if isinstance(favs2, list) else []):
            if not isinstance(m, dict) or "nama_menu" not in m:
                continue
            if m.get("nama_menu") in my_menus:
                try:
                    cooc[int(m["id_cafe"])].add(m["nama_menu"])
                except (ValueError, TypeError):
                    pass

    return {cid: sorted(list(ms)) for cid, ms in cooc.items()}

# function normalisasi sinyal dengan P95
def robust_normalize_scores(scores_dict, pct=95):
    if not scores_dict:
        return {}
    vals = np.array(list(scores_dict.values()), dtype=float)
    if np.allclose(vals, 0):
        return {k: 0.0 for k in scores_dict}
    denom = np.percentile(vals, pct)
    denom = float(denom) if denom > 0 else float(vals.max() or 1.0)
    return {k: min(1.0, float(v) / denom) for k, v in scores_dict.items()}

# function normalisasi skor ke skala 0 hingga 1
def normalize_number(x, cap=1.0):
    if x is None:
        return 0.0
    try:
        xv = float(x)
    except (ValueError, TypeError):
        return 0.0
    return max(0.0, min(1.0, xv / cap))

# konfigurasi cache untuk skor sentimen
_sentiment_cache = {}
_SENT_CACHE_TTL = 60 * 60  # 1 jam

# cek cache skor sentimen jika ada
def _sent_cache_get(cid):
    ent = _sentiment_cache.get(cid)
    if not ent:
        return (False, None)
    ts, val = ent
    if now_ts() - ts > _SENT_CACHE_TTL:
        _sentiment_cache.pop(cid, None)
        return (False, None)
    return (True, val)

# simpan skor sentimen ke cache
def _sent_cache_set(cid, value):
    _sentiment_cache[cid] = (now_ts(), value)

# hitung skor sentimen dalam skala 0 hingga 1
def compute_sentiment_score_from_reviews(reviews):
    if not reviews:
        return None

    scores = []
    for r in reviews:
        if not isinstance(r, dict):
            continue

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

    # implementasi Bayesian Smoothing
    raw_mean = float(sum(scores)) / len(scores)
    prior = 0.6
    prior_count = 5.0
    n = len(scores)
    smoothed = (raw_mean * n + prior * prior_count) / (n + prior_count)
    return float(max(0.0, min(1.0, smoothed)))

# hitung skor sentimen
def compute_sentiment_for_cafe(cid):
    # ambil sentimen dari cache (jika ada)
    exists, cached = _sent_cache_get(cid)
    if exists:
        return cached 

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

    # if reviews is None:
    #     raw = safe_get(f"{BASE}/api/reviews/{cid}")
    #     if isinstance(raw, list):
    #         reviews = raw
    #     elif isinstance(raw, dict) and "reviews" in raw and isinstance(raw["reviews"], list):
    #         reviews = raw["reviews"]
    #     else:
    #         reviews = None

    score = compute_sentiment_score_from_reviews(reviews) if reviews is not None else None
    _sent_cache_set(cid, score) 
    return score

# bangun model UBCF (mean-centering + cosine-similarity + KNN)
def build_cf_model():
    """
    [SIM:a] Build model CF:
    - Pivot user x cafe (nilai = harga rata-rata)
    - Mean-centering per user
    - Cosine-like similarity antar user
    - KNN di atas jarak = 1 - similarity
    """
    records = []
    users = fetch_all_users()
    if not users:
        data = safe_get(f"{BASE}/api/users") or []
        users = data if isinstance(data, list) else []

    # Kumpulkan interaksi pengguna ke kafe dengan harga dari 'menu_yang_disukai'
    for u in users:
        uid = u.get("id_user") or u.get("id") or u.get("user_id")
        if uid is None:
            continue
        raw = u.get("menu_yang_disukai") or "[]"
        try:
            favs = json.loads(raw) if isinstance(raw, str) else raw
        except json.JSONDecodeError:
            favs = []
        for m in (favs if isinstance(favs, list) else []):
            if isinstance(m, dict) and "id_cafe" in m and "harga" in m:
                try:
                    records.append({
                        "user_id": int(uid),
                        "cafe_id": int(m["id_cafe"]),
                        "harga":   int(str(m["harga"]).replace(".", ""))
                    })
                except (ValueError, TypeError):
                    pass

    df = pd.DataFrame(records)
    if df.empty:
        print("Error: Tidak ada data interaksi valid untuk build_cf_model.")
        return pd.DataFrame(), pd.DataFrame(), None

    # membuat matriks pengguna x kafe
    mat = df.pivot_table(index="user_id", columns="cafe_id", values="harga", fill_value=0)

    # mean-centering matriks pengguna x kafe
    X = mat.sub(mat.mean(axis=1), axis=0)

    # menghitung kemiripan antar pengguna dengan cosine similarity
    num = X.dot(X.T)
    norm = np.sqrt((X**2).sum(axis=1))
    den = np.outer(norm, norm) + 1e-8
    sim_vals = np.divide(num.values, den, out=np.zeros_like(num.values), where=den > 0)
    sim = pd.DataFrame(np.clip(sim_vals, -1, 1), index=mat.index, columns=mat.index)

    # menentukan tetangga terdekat dengan KNN
    dist = 1 - sim
    knn = NearestNeighbors(metric="precomputed", n_neighbors=min(7, len(sim)))
    knn.fit(dist.values)

    return mat, sim, knn

# hitung skor UBCF untuk pengguna target
def rec_ubcf_scores(uid, mat, sim, knn):
    if knn is None or uid not in sim.index:
        return {}

    # Ambil tetangga terdekat (K = 10, mengecualikan pengguna target)
    _, idxs = knn.kneighbors((1 - sim).loc[[uid]].values, n_neighbors=min(len(sim), 10))
    neigh = sim.index[idxs[0]][1:]

    scores = {}
    for cid in mat.columns:
        if mat.loc[uid, cid] == 0:
            num_ = sum(sim.loc[uid, v] * mat.loc[v, cid] for v in neigh)
            den_ = sum(abs(sim.loc[uid, v]) for v in neigh)
            val = num_ / den_ if den_ > 0 else 0.0
            if val > 0:
                scores[cid] = val
    return scores

# gabungkan kandidat dari tiga sinyal
def build_candidate_pool_from_signals(ubcf_raw, vf_raw, co_raw, top_n_each=50):
    pool = set()
    pool.update(sorted(ubcf_raw.keys(), key=lambda k: -ubcf_raw.get(k, 0))[:top_n_each])
    pool.update(sorted(vf_raw.keys(), key=lambda k: -vf_raw.get(k, 0))[:top_n_each])
    pool.update(sorted(co_raw.keys(), key=lambda k: -len(co_raw.get(k, [])))[:top_n_each])
    return list(pool)

# api rekomendasi
@app.route("/api/recommend/<int:uid>")
def api_recommend(uid):
    visited_list_raw = fetch_visited(uid)
    if not visited_list_raw:
        return jsonify({"recommendations": []})

    # Build UBCF & memanggil skor sinyal riwayat kunjungan dan menu yang disukai
    mat, sim, knn = build_cf_model()
    ubcf_raw = rec_ubcf_scores(uid, mat, sim, knn)
    vf_raw = rec_visited_freq(uid)
    co_raw = rec_menu_cooccur(uid)

    # Pool kandidat & filter kafe yang sudah dikunjungi
    pool = build_candidate_pool_from_signals(ubcf_raw, vf_raw, co_raw, top_n_each=50)
    MAX_POOL = 300
    if len(pool) > MAX_POOL:
        pool = pool[:MAX_POOL]

    seen = set(_normalize_visited_list(visited_list_raw))
    pool = [c for c in pool if c not in seen]
    if not pool:
        return jsonify({"recommendations": []})

    # Normalisasi skor
    ubcf_norm = robust_normalize_scores(ubcf_raw, pct=95)
    vf_norm = robust_normalize_scores(vf_raw, pct=95)
    co_counts = {k: len(v) for k, v in co_raw.items()}
    co_norm = robust_normalize_scores(co_counts, pct=95)

    # bobot masing-masing sinyal
    w_cf = 0.5
    w_vf = 0.2
    w_co = 0.2
    w_sent_and_rate = 0.1

    rows = []
    for cid in pool:
        info = fetch_cafe(cid) or {}

        cf_s = ubcf_norm.get(cid, 0.0)
        vf_s = vf_norm.get(cid, 0.0)
        co_s = co_norm.get(cid, 0.0)

        # Normalisasi rating & sentimen
        try:
            rating_val = float(info.get("rating", 0.0))
        except (ValueError, TypeError):
            rating_val = 0.0
        rating_n = normalize_number(rating_val, cap=5.0)

        sent_score = compute_sentiment_for_cafe(cid)
        sent_n = float(sent_score) if sent_score is not None else 0.5
        sent_and_rate = (sent_n + rating_n) / 2.0

        # Menggabungkan semua sinyal menjadi skor akhir
        combined = (w_cf * cf_s + w_vf * vf_s + w_co * co_s + w_sent_and_rate * sent_and_rate)

        rows.append({
            "cafe_id": cid,
            "nama_kafe": info.get("nama_kafe", ""),
            "alamat": info.get("alamat", ""),
            "rating": rating_val,
            "sentiment": round(sent_n, 2),
            "score": round(float(combined), 2),
            "matched_menu": co_raw.get(cid, [])
        })

    dfc = pd.DataFrame(rows)
    if dfc.empty:
        return jsonify({"recommendations": []})

    # mengambil Top-6 rekomendasi berdasarkan skor akhir tertinggi
    top6 = dfc.sort_values("score", ascending=False).head(6)
    return jsonify({"recommendations": top6.to_dict("records")})

# api evaluasi 
@app.route("/api/evaluate")
def api_evaluate():
    users = fetch_all_users(force=True)
    if not users:
        return jsonify({"error": "No users found"}), 400

    try:
        M = int(request.args.get("m", 3))
    except (ValueError, TypeError):
        M = 3
    if M < 1:
        M = 1

    try:
        folds = int(request.args.get("folds", 5))
    except (ValueError, TypeError):
        folds = 5
    if folds < 2:
        folds = 2

    # evaluasi urutan (ranking) rekomendasi
    mat, sim, knn = build_cf_model()
    vf_by_user = {}
    co_by_user = {}
    for u in users:
        uid_str = u.get("id_user") or u.get("id")
        if uid_str is None:
            continue
        try:
            uid = int(uid_str)
        except (ValueError, TypeError):
            continue
        try:
            vf_by_user[uid] = rec_visited_freq(uid)
        except Exception:
            vf_by_user[uid] = {}
        try:
            co_by_user[uid] = rec_menu_cooccur(uid)
        except Exception:
            co_by_user[uid] = {}

    w_cf = 0.5
    w_vf = 0.2
    w_co = 0.2
    w_sent_and_rate = 0.1

    ks = [1, 3, 5, 10]
    precision_sums = {k: 0.0 for k in ks}
    recall_sums = {k: 0.0 for k in ks}
    f1_sums = {k: 0.0 for k in ks}
    ndcg_sums = {k: 0.0 for k in ks}
    eval_user_count = 0

    mse_list = []
    mae_list = []

    for u in users:
        uid_str = u.get("id_user") or u.get("id")
        if uid_str is None:
            continue
        try:
            uid = int(uid_str)
        except (ValueError, TypeError):
            continue

        seq_raw = fetch_visited(uid)
        seq = _normalize_visited_list(seq_raw)
        if len(seq) < (M + 1):
            continue

        relevant_set = set(seq[-M:])
        seen_hist = set(seq[:-M])

        ubcf_raw = rec_ubcf_scores(uid, mat, sim, knn)
        vf_raw = vf_by_user.get(uid, {})
        co_raw = co_by_user.get(uid, {})

        pool = build_candidate_pool_from_signals(ubcf_raw, vf_raw, co_raw, top_n_each=50)
        pool = [c for c in pool if c not in seen_hist]
        for rel in relevant_set:
            if rel not in pool:
                pool.append(rel)

        if not pool:
            continue

        co_counts_eval = {k: len(v) for k, v in co_raw.items()}
        max_cf = max(ubcf_raw.values()) if ubcf_raw else 1.0
        max_vf = max(vf_raw.values()) if vf_raw else 1.0
        max_co = max(co_counts_eval.values()) if co_counts_eval else 1.0

        scores = {}
        for cid in pool:
            cf_n = ubcf_raw.get(cid, 0.0) / max_cf if max_cf > 0 else 0.0
            vf_n = vf_raw.get(cid, 0.0) / max_vf if max_vf > 0 else 0.0
            co_n = co_counts_eval.get(cid, 0.0) / max_co if max_co > 0 else 0.0

            info = fetch_cafe(cid) or {}
            try:
                rating_val = float(info.get("rating", 0.0))
            except (ValueError, TypeError):
                rating_val = 0.0
            rating_n = normalize_number(rating_val, cap=5.0)
            sent = compute_sentiment_for_cafe(cid)
            sent_n = float(sent) if sent is not None else 0.5
            sent_and_rate = (sent_n + rating_n) / 2.0

            scores[cid] = (w_cf * cf_n + w_vf * vf_n + w_co * co_n + w_sent_and_rate * sent_and_rate)

        pool_all = list(pool)
        preds = np.array([float(scores.get(cid, 0.0)) for cid in pool_all], dtype=float)
        actuals = np.array([1.0 if cid in relevant_set else 0.0 for cid in pool_all], dtype=float)

        if preds.size > 0:
            mse_u = float(np.mean((preds - actuals) ** 2))
            mae_u = float(np.mean(np.abs(preds - actuals)))
            mse_list.append(mse_u)
            mae_list.append(mae_u)

            # Hitung metrik ranking @K
            ranked = sorted(pool_all, key=lambda c: -scores.get(c, 0.0))
            R = len(relevant_set)

            for k in ks:
                topk = ranked[:k]
                denom_k = min(k, len(ranked))
                hits = sum(1 for c in topk if c in relevant_set)

                precision_k = (hits / denom_k) if denom_k > 0 else 0.0
                recall_k = (hits / R) if R > 0 else 0.0
                f1_k = 2.0 * precision_k * recall_k / (precision_k + recall_k) if (precision_k + recall_k) > 0 else 0.0

                dcg = 0.0
                for i, c in enumerate(topk):
                    if c in relevant_set:
                        dcg += 1.0 / math.log2(i + 2.0)
                ideal_hits = min(k, R)
                idcg = sum(1.0 / math.log2(i + 2.0) for i in range(ideal_hits))
                ndcg_k = (dcg / idcg) if idcg > 0 else 0.0

                precision_sums[k] += precision_k
                recall_sums[k] += recall_k
                f1_sums[k] += f1_k
                ndcg_sums[k] += ndcg_k

            eval_user_count += 1

    precision_at_k = {f"precision@{k}": round((precision_sums[k] / eval_user_count) if eval_user_count else 0.0, 4) for k in ks}
    recall_at_k = {f"recall@{k}": round((recall_sums[k] / eval_user_count) if eval_user_count else 0.0, 4) for k in ks}
    f1_at_k = {f"f1-score@{k}": round((f1_sums[k] / eval_user_count) if eval_user_count else 0.0, 4) for k in ks}
    ndcg_at_k = {f"ndcg@{k}": round((ndcg_sums[k] / eval_user_count) if eval_user_count else 0.0, 4) for k in ks}

    response = {
        "ranking_metrics": {
            "precision": {**precision_at_k},
            "recall": {**recall_at_k},
            "f1-score": {**f1_at_k},
            "ndcg": {**ndcg_at_k},
        }
    }

    # 5-fold cross-validation untuk RMSE & MAE
    user_folds = k_fold_split_users(users, k=folds, seed=42)

    mse_list_all = []
    mae_list_all = []
    eval_count_cv = 0
    per_fold_results = {}

    for i in range(folds):
        train_users = []
        test_users = user_folds[i]
        for j in range(folds):
            if j == i:
                continue
            train_users.extend(user_folds[j])

        mat_t, sim_t, knn_t = build_cf_model_from_users(train_users)

        mse_list_fold = []
        mae_list_fold = []
        eval_count_fold = 0

        for tu in test_users:
            try:
                uid = int(tu.get("id_user", tu.get("id", -1)))
            except (ValueError, TypeError):
                continue

            seq_raw = fetch_visited(uid)
            seq = _normalize_visited_list(seq_raw)
            if len(seq) < 2:
                continue

            test_cafe = seq[-1]
            seen_hist = set(seq[:-1])

            ubcf_raw = {}
            if not mat_t.empty and uid in mat_t.index:
                ubcf_raw = rec_ubcf_scores(uid, mat_t, sim_t, knn_t)

            vf_raw = compute_vf_from_users_for_uid(uid, train_users)
            co_raw = compute_cooccur_from_users_for_uid(uid, train_users)

            pool = build_candidate_pool_from_signals(ubcf_raw, vf_raw, co_raw, top_n_each=50)
            pool = [c for c in pool if c not in seen_hist]
            if test_cafe not in pool:
                pool.append(test_cafe)
            if not pool:
                continue

            co_counts_t = {k: len(v) for k, v in co_raw.items()}
            max_cf_t = max(ubcf_raw.values()) if ubcf_raw else 1.0
            max_vf_t = max(vf_raw.values()) if vf_raw else 1.0
            max_co_t = max(co_counts_t.values()) if co_counts_t else 1.0

            scores = {}
            for cid in pool:
                cf_n = ubcf_raw.get(cid, 0.0) / max_cf_t if max_cf_t > 0 else 0.0
                vf_n = vf_raw.get(cid, 0.0) / max_vf_t if max_vf_t > 0 else 0.0
                co_n = co_counts_t.get(cid, 0.0) / max_co_t if max_co_t > 0 else 0.0

                info = fetch_cafe(cid) or {}
                try:
                    rating_val = float(info.get("rating", 0.0))
                except (ValueError, TypeError):
                    rating_val = 0.0
                rating_n = normalize_number(rating_val, cap=5.0)
                sent = compute_sentiment_for_cafe(cid)
                sent_n = float(sent) if sent is not None else 0.5
                sent_and_rate = (sent_n + rating_n) / 2.0

                w_cf = 0.5
                w_vf = 0.2
                w_co = 0.2
                w_sent_and_rate = 0.1
                scores[cid] = (w_cf * cf_n + w_vf * vf_n + w_co * co_n + w_sent_and_rate * sent_and_rate)

            pool_all = list(pool)
            preds = np.array([float(scores.get(cid, 0.0)) for cid in pool_all], dtype=float)
            actuals = np.array([1.0 if cid == test_cafe else 0.0 for cid in pool_all], dtype=float)

            if preds.size > 0:
                mse_u = float(np.mean((preds - actuals) ** 2))
                mae_u = float(np.mean(np.abs(preds - actuals)))
                mse_list_fold.append(mse_u)
                mae_list_fold.append(mae_u)
                mse_list_all.append(mse_u)
                mae_list_all.append(mae_u)
                eval_count_fold += 1
                eval_count_cv += 1

        if mse_list_fold:
            mean_mse_fold = float(np.mean(mse_list_fold))
            mean_mae_fold = float(np.mean(mae_list_fold))
            rmse_fold = math.sqrt(mean_mse_fold) if mean_mse_fold >= 0 else 0.0
        else:
            rmse_fold, mean_mae_fold = None, None

        per_fold_results[f"fold-{i+1}"] = {
            "RMSE": round(rmse_fold, 4) if rmse_fold is not None else "N/A",
            "MAE": round(mean_mae_fold, 4) if mean_mae_fold is not None else "N/A",
        }

    mean_mse_cv = float(np.mean(mse_list_all)) if mse_list_all else 0.0
    mean_mae_cv = float(np.mean(mae_list_all)) if mae_list_all else 0.0
    rmse_cv = math.sqrt(mean_mse_cv) if mean_mse_cv >= 0 else 0.0

    response["5-fold-cross-validation"] = {
        "per_fold": per_fold_results,
        "RMSE": round(rmse_cv, 4),
        "MAE": round(mean_mae_cv, 4),
    }

    return jsonify(response)

def build_cf_model_from_users(users_list):
    records = []
    for u in users_list:
        uid = u.get("id_user") or u.get("id") or u.get("user_id")
        if uid is None:
            continue
        raw = u.get("menu_yang_disukai") or "[]"
        try:
            favs = json.loads(raw) if isinstance(raw, str) else raw
        except json.JSONDecodeError:
            favs = []
        for m in (favs if isinstance(favs, list) else []):
            if isinstance(m, dict) and "id_cafe" in m and "harga" in m:
                try:
                    records.append({
                        "user_id": int(uid),
                        "cafe_id": int(m["id_cafe"]),
                        "harga":   int(str(m["harga"]).replace(".", ""))
                    })
                except (ValueError, TypeError):
                    pass

    if not records:
        return pd.DataFrame(), pd.DataFrame(), None

    df = pd.DataFrame(records)
    mat = df.pivot_table(index="user_id", columns="cafe_id", values="harga", fill_value=0)
    if mat.empty:
        return pd.DataFrame(), pd.DataFrame(), None

    X = mat.sub(mat.mean(axis=1), axis=0)
    num = X.dot(X.T)
    norm = np.sqrt((X**2).sum(axis=1))
    den = np.outer(norm, norm) + 1e-8
    sim_vals = np.divide(num.values, den, out=np.zeros_like(num.values), where=den > 0)
    sim = pd.DataFrame(np.clip(sim_vals, -1, 1), index=mat.index, columns=mat.index)
    dist = 1 - sim

    knn = None
    if len(sim) > 0:
        try:
            k_neighbors = min(7, len(sim))
            knn = NearestNeighbors(metric="precomputed", n_neighbors=k_neighbors)
            knn.fit(dist.values)
        except Exception:
            knn = None

    return mat, sim, knn

def compute_vf_from_users_for_uid(uid, users_list):
    raw_me = fetch_visited(uid)
    my_seq = _normalize_visited_list(raw_me)
    if not my_seq:
        return {}

    trans = defaultdict(list)
    for other in users_list:
        try:
            other_id = int(other.get("id_user", other.get("id", -1)))
            if other_id == int(uid):
                continue
        except (ValueError, TypeError):
            continue

        raw = other.get("cafe_telah_dikunjungi") or "[]"
        seq2 = _normalize_visited_list(raw)
        for a, b in zip(seq2, seq2[1:]):
            try:
                trans[int(a)].append(int(b))
            except (ValueError, TypeError):
                continue

    flat = []
    for a in my_seq:
        try:
            flat.extend(trans.get(int(a), []))
        except (ValueError, TypeError):
            continue

    if not flat:
        return {}
    counts = {}
    for v in flat:
        counts[v] = counts.get(v, 0) + 1
    return counts

def compute_cooccur_from_users_for_uid(uid, users_list):
    me = fetch_user(uid)
    if not me:
        return {}

    raw = me.get("menu_yang_disukai") or "[]"
    try:
        my_list = json.loads(raw) if isinstance(raw, str) else raw
    except json.JSONDecodeError:
        my_list = []

    my_menus = {m["nama_menu"] for m in my_list if isinstance(m, dict) and "nama_menu" in m}
    if not my_menus:
        return {}

    cooc = defaultdict(set)
    for other in users_list:
        try:
            other_id = other.get("id_user") or other.get("id")
            if other_id is None or str(other_id) == str(uid):
                continue
        except Exception:
            continue

        raw2 = other.get("menu_yang_disukai") or "[]"
        try:
            favs2 = json.loads(raw2) if isinstance(raw2, str) else raw2
        except json.JSONDecodeError:
            favs2 = []

        for m in (favs2 if isinstance(favs2, list) else []):
            if not isinstance(m, dict) or "nama_menu" not in m:
                continue
            if m.get("nama_menu") in my_menus:
                try:
                    cooc[int(m["id_cafe"])].add(m["nama_menu"])
                except (ValueError, TypeError):
                    pass
    return {cid: sorted(list(ms)) for cid, ms in cooc.items()}

def k_fold_split_users(users_list, k=5, seed=42):
    candidates = []
    for u in users_list:
        try:
            uid = int(u.get("id_user", u.get("id", -1)))
            candidates.append((uid, u))
        except (ValueError, TypeError):
            continue

    candidates.sort(key=lambda x: x[0])
    rng = random.Random(seed)
    ids_and_users = [u for _, u in candidates]
    rng.shuffle(ids_and_users)

    folds = [[] for _ in range(k)]
    for idx, user in enumerate(ids_and_users):
        folds[idx % k].append(user)
    return folds

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
