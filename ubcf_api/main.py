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
from urllib.parse import urlparse, urlunparse
import os
import random  # added for deterministic CV splits

app = Flask(__name__)
CORS(app)

BASE = "http://127.0.0.1:8080"
BASE = BASE.rstrip("/")

session = requests.Session()
session.headers.update({"ngrok-skip-browser-warning": "true"})
DEFAULT_TIMEOUT = 6  # seconds

CACHE_TTL = 2

_cafes_cache = {"ts": 0, "data": None}
_users_cache = {"ts": 0, "data": None}
_sentiment_cache = {}  
_SENT_CACHE_TTL = 60 * 60 

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
    except requests.exceptions.SSLError as ssle:
        try:
            parsed = urlparse(url)
            host = parsed.netloc or ""
            if "ngrok" in host and parsed.scheme == "https":
                alt = parsed._replace(scheme="http")
                alt_url = urlunparse(alt)
                try:
                    r2 = session.get(alt_url, timeout=timeout)
                    r2.raise_for_status()
                    return r2.json()
                except Exception:
                    return None
        except Exception:
            pass
        return None
    except Exception:
        return None

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
            except:
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
            except:
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
        except:
            return []
    return []

def _sent_cache_get(cid):
    ent = _sentiment_cache.get(cid)
    if not ent:
        return None
    ts, val = ent
    if now_ts() - ts > _SENT_CACHE_TTL:
        _sentiment_cache.pop(cid, None)
        return None
    return val

def _sent_cache_set(cid, value):
    _sentiment_cache[cid] = (now_ts(), value)

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
        raw = safe_get(f"{BASE}/api/reviews/{cid}")
        if isinstance(raw, list):
            reviews = raw
        elif isinstance(raw, dict) and "reviews" in raw and isinstance(raw["reviews"], list):
            reviews = raw["reviews"]
        else:
            reviews = None
    score = compute_sentiment_score_from_reviews(reviews) if reviews is not None else None
    _sent_cache_set(cid, score)
    return score

def build_cf_model():
    records = []
    users = fetch_all_users()
    if not users:
        data = safe_get(f"{BASE}/api/users") or []
        users = data if isinstance(data, list) else []

    for u in users:
        uid = u.get("id_user") or u.get("id") or u.get("user_id")
        if uid is None:
            continue
        raw = u.get("menu_yang_disukai") or "[]"
        try:
            favs = json.loads(raw) if isinstance(raw, str) else raw
        except:
            favs = []
        for m in (favs if isinstance(favs, list) else []):
            if isinstance(m, dict) and "id_cafe" in m and "harga" in m:
                try:
                    records.append({
                        "user_id": int(uid),
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
    neigh = sim.index[idxs[0]][1:]
    scores = {}
    for cid in mat.columns:
        if mat.loc[uid, cid] == 0:
            num_ = sum(sim.loc[uid, v]*mat.loc[v, cid] for v in neigh)
            den_ = sum(abs(sim.loc[uid, v]) for v in neigh)
            val = num_/den_ if den_>0 else 0.0
            if val > 0:
                scores[cid] = val
    return scores

def _normalize_visited_list(raw_vis):
    out = []
    if raw_vis is None:
        return out
    if isinstance(raw_vis, list):
        items = raw_vis
    elif isinstance(raw_vis, str):
        try:
            parsed = json.loads(raw_vis)
            if isinstance(parsed, list):
                items = parsed
            else:
                if "," in raw_vis:
                    items = [s.strip() for s in raw_vis.split(",") if s.strip()]
                else:
                    items = []
        except:
            if "," in raw_vis:
                items = [s.strip() for s in raw_vis.split(",") if s.strip()]
            else:
                items = []
    else:
        return out

    for it in items:
        if isinstance(it, dict):
            for k in ("id_cafe", "nomor", "cafe_id", "id"):
                if k in it and it[k] not in (None, ""):
                    try:
                        out.append(int(it[k]))
                    except:
                        pass
                    break
        else:
            try:
                out.append(int(it))
            except:
                pass
    return out

def rec_visited_freq(uid):
    users = fetch_all_users()
    if not users:
        return {}

    my_seq = []
    for u in users:
        try:
            u_id = int(u.get("id_user", u.get("id", -1)))
        except:
            continue
        if u_id == int(uid):
            raw = u.get("cafe_telah_dikunjungi") or u.get("visited") or u.get("cafe_telah_dikunjungi", "[]")
            my_seq = _normalize_visited_list(raw)
            break

    if not my_seq:
        try:
            raw2 = fetch_visited(uid)
            my_seq = _normalize_visited_list(raw2)
        except:
            my_seq = []

    trans = defaultdict(list)

    for other in users:
        try:
            other_id = int(other.get("id_user", other.get("id", -1)))
        except:
            continue
        if other_id == int(uid):
            continue
        raw = other.get("cafe_telah_dikunjungi") or other.get("visited") or other.get("cafe_telah_dikunjungi", "[]")
        seq2 = _normalize_visited_list(raw)
        for a, b in zip(seq2, seq2[1:]):
            try:
                trans[int(a)].append(int(b))
            except:
                continue

    flat = []
    for a in my_seq:
        try:
            flat.extend(trans.get(int(a), []))
        except:
            continue

    if not flat:
        return {}
    counts = {}
    for v in flat:
        counts[v] = counts.get(v, 0) + 1
    return counts

def rec_menu_cooccur(uid):
    users = fetch_all_users()
    me = next((u for u in users if int(u.get("id_user", u.get("id", -1)))==int(uid)), {})
    raw = me.get("menu_yang_disukai") or "[]"
    try:
        my_list = json.loads(raw) if isinstance(raw, str) else raw
    except:
        my_list = []
    my_menus = {m["nama_menu"] for m in my_list if isinstance(m, dict)}
    cooc = defaultdict(set)
    for other in users:
        other_id = other.get("id_user") or other.get("id")
        if other_id is None or int(other_id) == int(uid):
            continue
        raw2 = other.get("menu_yang_disukai") or "[]"
        try:
            favs2 = json.loads(raw2) if isinstance(raw2, str) else raw2
        except:
            favs2 = []
        for m in (favs2 if isinstance(favs2, list) else []):
            if not isinstance(m, dict): 
                continue
            if m.get("nama_menu") in my_menus:
                try:
                    cooc[int(m["id_cafe"])].add(m["nama_menu"])
                except:
                    pass
    return {cid: sorted(list(ms)) for cid,ms in cooc.items()}

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

def build_candidate_pool_from_signals(cf_raw, vf_raw, co_raw, top_n_each=50):
    pool = set()
    pool.update(sorted(cf_raw.keys(), key=lambda k: -cf_raw.get(k, 0))[:top_n_each])
    pool.update(sorted(vf_raw.keys(), key=lambda k: -vf_raw.get(k, 0))[:top_n_each])
    pool.update(sorted(co_raw.keys(), key=lambda k: -len(co_raw.get(k, [])))[:top_n_each])
    return list(pool)

# -------------------- API recommend --------------------
@app.route("/api/recommend/<int:uid>")
def api_recommend(uid):
    visited_list = fetch_visited(uid)
    if not visited_list:
        return jsonify({"recommendations": []})

    # build CF model from cached users
    mat, sim, knn = build_cf_model()
    cf_raw = rec_menu_scores(uid, mat, sim, knn)

    vf_raw = rec_visited_freq(uid)
    co_raw = rec_menu_cooccur(uid)

    all_vf = {}
    users = fetch_all_users()
    for u in users:
        raw = u.get("cafe_telah_dikunjungi") or "[]"
        arr = []
        if isinstance(raw, list):
            arr = raw
        elif isinstance(raw, str):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    arr = parsed
            except:
                arr = []
        for v in arr:
            if isinstance(v, dict) and "id_cafe" in v:
                try:
                    k = int(v["id_cafe"])
                    all_vf[k] = all_vf.get(k, 0) + 1
                except:
                    continue


    pool = build_candidate_pool_from_signals(cf_raw, vf_raw, co_raw, top_n_each=50)
    MAX_POOL = 300
    if len(pool) > MAX_POOL:
        pool = pool[:MAX_POOL]

    # remove already visited cafe
    seen = {int(v["id_cafe"]) for v in visited_list if isinstance(v, dict)}
    pool = [c for c in pool if c not in seen]
    if not pool:
        return jsonify({"recommendations": []})

    cf_norm = robust_normalize_scores(cf_raw, pct=95)
    vf_norm = robust_normalize_scores(vf_raw, pct=95)
    co_counts = {k: len(v) for k, v in co_raw.items()}
    co_norm = robust_normalize_scores(co_counts, pct=95)

    w_cf = 0.5; w_vf = 0.2; w_co =0.2; w_sent_and_rate = 0.1

    rows = []
    # iterate pool
    for cid in pool:
        info = fetch_cafe(cid) or {}
        cf_s = cf_norm.get(cid, 0.0); vf_s = vf_norm.get(cid, 0.0); co_s = co_norm.get(cid, 0.0)
        try:
            rating_val = float(info.get("rating", 0.0))
        except:
            rating_val = 0.0
        rating_n = normalize_number(rating_val, cap=5.0)
        sent_score = compute_sentiment_for_cafe(cid)
        sent_n = float(sent_score) if sent_score is not None else 0.5
        sent_and_rate = (sent_n + rating_n) / 2.0

        combined = (w_cf * cf_s + w_vf * vf_s + w_co * co_s + w_sent_and_rate * sent_and_rate)

        rows.append({
            "cafe_id": cid,
            "nama_kafe": info.get("nama_kafe", ""),
            "alamat": info.get("alamat", ""),
            "rating": rating_val,
            "sentiment": round(sent_n, 4),
            "score": round(float(combined), 4),
            "matched_menu": co_raw.get(cid, [])
        })

    dfc = pd.DataFrame(rows)
    if dfc.empty:
        return jsonify({"recommendations": []})
    top6 = dfc.sort_values("score", ascending=False).head(6)
    return jsonify({"recommendations": top6.to_dict("records")})

# evaluate section (now includes 5-fold CV for RMSE/MAE)
@app.route("/api/evaluate")
def api_evaluate():
    users = fetch_all_users()
    if not users:
        return jsonify({"error": "No users found"}), 400

    # M = number of last items considered relevant per user for ranking metrics
    try:
        M = int(request.args.get("m", 3))
    except:
        M = 3
    if M < 1:
        M = 1

    # folds param for CV (used to compute RMSE/MAE via CV)
    try:
        folds = int(request.args.get("folds", 5))
    except:
        folds = 5
    if folds < 2:
        folds = 2

    # --- Ranking metrics & non-CV evaluation (kept as before) ---
    mat, sim, knn = build_cf_model()
    vf_by_user = {}
    co_by_user = {}
    for u in users:
        uid = u.get("id_user") or u.get("id")
        if uid is None:
            continue
        try:
            vf_by_user[int(uid)] = rec_visited_freq(uid)
        except Exception:
            vf_by_user[int(uid)] = {}
        try:
            co_by_user[int(uid)] = rec_menu_cooccur(uid)
        except Exception:
            co_by_user[int(uid)] = {}

    # all_vf kept (not used in current scoring for ranking eval)
    all_vf = {}
    for u, vfmap in vf_by_user.items():
        for k, v in vfmap.items():
            all_vf[k] = all_vf.get(k, 0) + v

    w_cf = 0.5; w_vf = 0.2; w_co = 0.2; w_sent_and_rate = 0.1

    mse_list = []
    mae_list = []

    ks = [1, 3, 5, 10]
    precision_sums = {k: 0.0 for k in ks}
    recall_sums = {k: 0.0 for k in ks}
    f1_sums = {k: 0.0 for k in ks}
    ndcg_sums = {k: 0.0 for k in ks}
    eval_user_count = 0

    for uid in [int(u.get("id_user", u.get("id", -1))) for u in users if (u.get("id_user") or u.get("id"))]:
        seq = [v["id_cafe"] for v in fetch_visited(uid) if isinstance(v, dict)]
        if len(seq) < (M + 1):
            continue

        relevant_set = set(seq[-M:])
        seen_hist = set(seq[:-M])

        cf_raw = rec_menu_scores(uid, mat, sim, knn)
        vf_raw = vf_by_user.get(uid, {}) or {}
        co_raw = co_by_user.get(uid, {}) or {}

        pool = build_candidate_pool_from_signals(cf_raw, vf_raw, co_raw, top_n_each=50)
        pool = [c for c in pool if c not in seen_hist]

        for rel in relevant_set:
            if rel not in pool:
                pool.append(rel)

        if not pool:
            continue

        # normalisasi sinyal
        max_cf = max(cf_raw.values()) if cf_raw else 1.0
        max_vf = max(vf_raw.values()) if vf_raw else 1.0
        max_co = max((len(v) for v in co_raw.values()), default=1)

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

            # Ranking metrics
            ranked = sorted(pool_all, key=lambda c: -scores.get(c, 0.0))
            R = len(relevant_set)

            for k in ks:
                topk = ranked[:k]
                denom_k = min(k, len(ranked))
                hits = sum(1 for c in topk if c in relevant_set)

                precision_k = (hits / denom_k) if denom_k > 0 else 0.0
                recall_k = (hits / R) if R > 0 else 0.0
                if precision_k + recall_k > 0:
                    f1_k = 2.0 * precision_k * recall_k / (precision_k + recall_k)
                else:
                    f1_k = 0.0

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
        else:
            mse_list.append(0.0)
            mae_list.append(0.0)

    precision_at_k = {f"precision@{k}": round((precision_sums[k] / eval_user_count) if eval_user_count else 0.0, 4) for k in ks}
    recall_at_k = {f"recall@{k}": round((recall_sums[k] / eval_user_count) if eval_user_count else 0.0, 4) for k in ks}
    f1_at_k = {f"f1-score@{k}": round((f1_sums[k] / eval_user_count) if eval_user_count else 0.0, 4) for k in ks}
    ndcg_at_k = {f"ndcg@{k}": round((ndcg_sums[k] / eval_user_count) if eval_user_count else 0.0, 4) for k in ks}

    # Prepare response skeleton (ranking metrics included)
    response = {
        "ranking_metrics": {
            "precision" : { **precision_at_k },
            "recall" : { **recall_at_k },
            "f1-score" : { **f1_at_k },
            "ndcg" : { **ndcg_at_k }
        }
    }

    # --- Now run k-fold cross validation over users to compute CV RMSE/MAE ---
    # deterministic fold split
    user_folds = k_fold_split_users(users, k=folds, seed=42)

    mse_list_all = []
    mae_list_all = []
    eval_count_cv = 0
    per_fold_results = {}

    for i in range(folds):
        # training users = all except fold i
        train_users = []
        test_users = user_folds[i]
        for j in range(folds):
            if j == i:
                continue
            train_users.extend(user_folds[j])

        # build CF model from training users only
        mat_t, sim_t, knn_t = build_cf_model_from_users(train_users)

        mse_list_fold = []
        mae_list_fold = []
        eval_count_fold = 0

        for tu in test_users:
            try:
                uid = int(tu.get("id_user", tu.get("id", -1)))
            except:
                continue
            seq_raw = fetch_visited(uid)
            seq = [v["id_cafe"] for v in seq_raw if isinstance(v, dict)]
            if len(seq) < 2:
                continue
            test_cafe = seq[-1]
            seen_hist = set(seq[:-1])

            # compute signals using training users only:
            cf_raw = {}
            if not mat_t.empty and uid in mat_t.index:
                cf_raw = rec_menu_scores(uid, mat_t, sim_t, knn_t)

            vf_raw = compute_vf_from_users_for_uid(uid, train_users)
            co_raw = compute_cooccur_from_users_for_uid(uid, train_users)

            pool = build_candidate_pool_from_signals(cf_raw, vf_raw, co_raw, top_n_each=50)
            pool = [c for c in pool if c not in seen_hist]
            if test_cafe not in pool:
                pool.append(test_cafe)

            if not pool:
                continue

            # normalize signals
            max_cf = max(cf_raw.values()) if cf_raw else 1.0
            max_vf = max(vf_raw.values()) if vf_raw else 1.0
            max_co = max((len(v) for v in co_raw.values()), default=1)

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
                sent_and_rate = (sent_n + rating_n) / 2.0

                # use same weights as main code
                w_cf = 0.5; w_vf = 0.2; w_co = 0.2; w_sent_and_rate = 0.1
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
            mae_fold = mean_mae_fold
        else:
            rmse_fold = None
            mae_fold = None

        per_fold_results[f"fold-{i+1}"] = {
            "RMSE": round(rmse_fold, 4) if rmse_fold is not None else None,
            "MAE": round(mae_fold, 4) if mae_fold is not None else None,
            # "user_evaluated": eval_count_fold
        }

    # overall aggregated metrics across all folds
    mean_mse_cv = float(np.mean(mse_list_all)) if mse_list_all else 0.0
    mean_mae_cv = float(np.mean(mae_list_all)) if mae_list_all else 0.0
    rmse_cv = math.sqrt(mean_mse_cv) if mean_mse_cv >= 0 else 0.0

    # attach CV results to response
    response["5-fold-cross-validation"] = {
        "evaluated_users_total": eval_count_cv,
        "per_fold": per_fold_results,
        "RMSE": round(rmse_cv, 4),
        "MAE": round(mean_mae_cv, 4)
    }

    return jsonify(response)

def build_cf_model_from_users(users_list):
    """Build CF model (mat, sim, knn) from a given list of user dicts (does not call fetch_all_users)."""
    records = []
    for u in users_list:
        uid = u.get("id_user") or u.get("id") or u.get("user_id")
        if uid is None:
            continue
        raw = u.get("menu_yang_disukai") or "[]"
        try:
            favs = json.loads(raw) if isinstance(raw, str) else raw
        except:
            favs = []
        for m in (favs if isinstance(favs, list) else []):
            if isinstance(m, dict) and "id_cafe" in m and "harga" in m:
                try:
                    records.append({
                        "user_id": int(uid),
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
    knn  = NearestNeighbors(metric="precomputed", n_neighbors=min(5, len(sim))) if len(sim) > 0 else None
    if knn is not None:
        knn.fit(dist.values)
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
        except:
            continue
        if other_id == int(uid):
            continue
        raw = other.get("cafe_telah_dikunjungi") or other.get("visited") or other.get("cafe_telah_dikunjungi", "[]")
        seq2 = _normalize_visited_list(raw)
        for a, b in zip(seq2, seq2[1:]):
            try:
                trans[int(a)].append(int(b))
            except:
                continue
    flat = []
    for a in my_seq:
        try:
            flat.extend(trans.get(int(a), []))
        except:
            continue
    if not flat:
        return {}
    counts = {}
    for v in flat:
        counts[v] = counts.get(v, 0) + 1
    return counts

def compute_cooccur_from_users_for_uid(uid, users_list):
    me = fetch_user(uid) or {}
    raw = me.get("menu_yang_disukai") or "[]"
    try:
        my_list = json.loads(raw) if isinstance(raw, str) else raw
    except:
        my_list = []
    my_menus = {m["nama_menu"] for m in my_list if isinstance(m, dict)}
    cooc = defaultdict(set)
    for other in users_list:
        try:
            other_id = other.get("id_user") or other.get("id")
        except:
            other_id = None
        if other_id is None or int(other_id) == int(uid):
            continue
        raw2 = other.get("menu_yang_disukai") or "[]"
        try:
            favs2 = json.loads(raw2) if isinstance(raw2, str) else raw2
        except:
            favs2 = []
        for m in (favs2 if isinstance(favs2, list) else []):
            if not isinstance(m, dict):
                continue
            if m.get("nama_menu") in my_menus:
                try:
                    cooc[int(m["id_cafe"])].add(m["nama_menu"])
                except:
                    pass
    return {cid: sorted(list(ms)) for cid, ms in cooc.items()}

def k_fold_split_users(users_list, k=5, seed=42):
    candidates = []
    for u in users_list:
        try:
            uid = int(u.get("id_user", u.get("id", -1)))
        except:
            continue
        candidates.append((uid, u))
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
