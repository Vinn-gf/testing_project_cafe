from flask import Flask, jsonify
from flask_cors import CORS
import requests
import pandas as pd
import numpy as np
import json
from sklearn.neighbors import NearestNeighbors
from collections import defaultdict

app = Flask(__name__)
CORS(app)

BASE = "http://127.0.0.1:8080"
session = requests.Session()
session.headers.update({"ngrok-skip-browser-warning": "true"})

def fetch_all_user_ids():
    r = session.get(f"{BASE}/api/users"); r.raise_for_status()
    return [int(u["id_user"]) for u in r.json()]

def fetch_user(uid):
    r = session.get(f"{BASE}/api/users/{uid}"); r.raise_for_status()
    return r.json()

def fetch_visited(uid):
    r = session.get(f"{BASE}/api/visited/{uid}"); r.raise_for_status()
    data = r.json()
    return data if isinstance(data, list) else data.get("visited_cafes", [])

def fetch_cafe(cid):
    r = session.get(f"{BASE}/api/cafe/{cid}"); r.raise_for_status()
    return r.json()

# ────────────────────────────────────────────────────────────────────────────────
# 1) Membangun ulang model CF dari data terbaru
def build_cf_model():
    records = []
    for uid in fetch_all_user_ids():
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
                        "user_id":  uid,
                        "cafe_id":  int(m["id_cafe"]),
                        "harga":    int(str(m["harga"]).replace(".", ""))
                    })
                except:
                    pass

    df = pd.DataFrame(records)
    if df.empty:
        return pd.DataFrame(), pd.DataFrame(), None

    mat = df.pivot_table(
        index="user_id", columns="cafe_id", values="harga", fill_value=0
    )
    X    = mat.sub(mat.mean(axis=1), axis=0)
    num  = X.dot(X.T)
    norm = np.sqrt((X**2).sum(axis=1))
    den  = np.outer(norm, norm) + 1e-8
    sim_vals = np.divide(num.values, den, out=np.zeros_like(num.values), where=den>0)
    sim = pd.DataFrame(np.clip(sim_vals, -1,1), index=mat.index, columns=mat.index)
    dist = 1 - sim
    knn  = NearestNeighbors(metric="precomputed", n_neighbors=min(5, len(sim)))
    knn.fit(dist.values)

    return mat, sim, knn

# ────────────────────────────────────────────────────────────────────────────────
# 2) Collaborative Filtering (prediksi “harga”)
def rec_menu_scores(uid, mat, sim, knn):
    if knn is None or uid not in sim.index:
        return {}
    _, idxs = knn.kneighbors((1 - sim).loc[[uid]].values,
                              n_neighbors=min(len(sim), 6))
    neigh = sim.index[idxs[0][1:]]
    scores = {}
    for cid in mat.columns:
        if mat.loc[uid, cid] == 0:
            num_ = sum(sim.loc[uid, v] * mat.loc[v, cid] for v in neigh)
            den_ = sum(abs(sim.loc[uid, v]) for v in neigh)
            val  = num_ / den_ if den_ > 0 else 0.0
            if val > 0:
                scores[cid] = val
    return scores

# ────────────────────────────────────────────────────────────────────────────────
# 3) Visited Frequency (transisi A→B)
def rec_visited_freq(uid):
    seq   = [v["id_cafe"] for v in fetch_visited(uid) if isinstance(v, dict)]
    trans = defaultdict(list)
    for other in fetch_all_user_ids():
        if other == uid: continue
        seq2 = [v["id_cafe"] for v in fetch_visited(other) if isinstance(v, dict)]
        for a, b in zip(seq2, seq2[1:]):
            trans[a].append(b)
    flat = sum((trans[a] for a in seq), [])
    return pd.Series(flat).value_counts().to_dict() if flat else {}

# ────────────────────────────────────────────────────────────────────────────────
# 4) Co‑occurrence menu (suka menu sama di kafe beda)
def rec_menu_cooccur(uid):
    me = fetch_user(uid)
    raw = me.get("menu_yang_disukai") or "[]"
    try:
        my_favs = {m["nama_menu"] for m in json.loads(raw) if isinstance(m, dict)}
    except:
        my_favs = set()
    cooc = defaultdict(int)
    for other in fetch_all_user_ids():
        if other == uid: continue
        u2 = fetch_user(other)
        try:
            favs2 = json.loads(u2.get("menu_yang_disliked") or "[]")
        except:
            favs2 = []
        for m in (favs2 if isinstance(favs2, list) else []):
            if isinstance(m, dict) and m["nama_menu"] in my_favs:
                cooc[int(m["id_cafe"])] += 1
    return dict(cooc)

# ────────────────────────────────────────────────────────────────────────────────
# API Hybrid UBCF + VF + CO
@app.route("/api/recommend/<int:uid>")
def api_recommend(uid):
    mat, sim, knn = build_cf_model()

    cf_raw = rec_menu_scores(uid, mat, sim, knn)
    vf_raw = rec_visited_freq(uid)
    co_raw = rec_menu_cooccur(uid)

    max_cf = max(cf_raw.values()) if cf_raw else 1.0
    max_vf = max(vf_raw.values()) if vf_raw else 1.0
    max_co = max(co_raw.values()) if co_raw else 1.0

    pool = set(cf_raw) | set(vf_raw) | set(co_raw)
    seen = {v["id_cafe"] for v in fetch_visited(uid) if isinstance(v, dict)}
    pool = [c for c in pool if c not in seen]

    α, β, γ = 0.6, 0.2, 0.2
    rows = []
    for cid in pool:
        info     = fetch_cafe(cid)
        cf_n     = cf_raw.get(cid, 0) / max_cf
        vf_n     = vf_raw.get(cid, 0) / max_vf
        co_n     = co_raw.get(cid, 0) / max_co
        combined = α*cf_n + β*vf_n + γ*co_n
        rows.append({
            "cafe_id":   cid,
            "nama_kafe": info.get("nama_kafe",""),
            "alamat":    info.get("alamat",""),
            "rating":    float(info.get("rating",0)),
            "score":     round(combined, 6)
        })

    dfc = pd.DataFrame(rows)
    # 1) Top‑6 berdasarkan score DESC, rating DESC
    top6 = dfc.sort_values(["score","rating"], ascending=[False,False]).head(6)
    # 2) Resort 6 itu by rating DESC
    top6 = top6.sort_values("rating", ascending=False)

    return jsonify({"recommendations": top6.to_dict("records")})

# ────────────────────────────────────────────────────────────────────────────────
# API Pure UBCF
@app.route("/api/recommend_ubcf/<int:uid>")
def api_recommend_ubcf(uid):
    mat, sim, knn = build_cf_model()
    cf_raw = rec_menu_scores(uid, mat, sim, knn)
    if not cf_raw:
        return jsonify({"recommendations": []})

    max_cf = max(cf_raw.values())
    seen   = {v["id_cafe"] for v in fetch_visited(uid) if isinstance(v, dict)}

    rows = []
    for cid, score in cf_raw.items():
        if cid in seen: continue
        info = fetch_cafe(cid)
        rows.append({
            "cafe_id":   cid,
            "nama_kafe": info.get("nama_kafe",""),
            "alamat":    info.get("alamat",""),
            "rating":    float(info.get("rating",0)),
            "score":     round(score / max_cf, 6)
        })

    df = pd.DataFrame(rows)
    top6 = df.sort_values(["score","rating"], ascending=[False,False]).head(6)
    top6 = top6.sort_values("rating", ascending=False)

    return jsonify({"recommendations": top6.to_dict("records")})

# ────────────────────────────────────────────────────────────────────────────────
# API Evaluate (leave–one–out)
@app.route("/api/evaluate")
def api_evaluate():
    mat, sim, knn = build_cf_model()
    hits, mrrs = [], []

    for uid in fetch_all_user_ids():
        seq = [v["id_cafe"] for v in fetch_visited(uid) if isinstance(v, dict)]
        if len(seq) < 2: continue
        test, hist = seq[-1], seq[:-1]

        cf_raw = rec_menu_scores(uid, mat, sim, knn)
        vf_raw = rec_visited_freq(uid)
        co_raw = rec_menu_cooccur(uid)

        max_cf = max(cf_raw.values()) if cf_raw else 1.0
        max_vf = max(vf_raw.values()) if vf_raw else 1.0
        max_co = max(co_raw.values()) if co_raw else 1.0

        pool = (set(cf_raw) | set(vf_raw) | set(co_raw)) - set(hist)
        α, β, γ = 0.6, 0.2, 0.2
        scored = []
        for cid in pool:
            cf_n = cf_raw.get(cid, 0) / max_cf
            vf_n = vf_raw.get(cid, 0) / max_vf
            co_n = co_raw.get(cid, 0) / max_co
            scored.append((cid, α*cf_n + β*vf_n + γ*co_n))

        ranked = [cid for cid, _ in sorted(scored, key=lambda x: -x[1])]
        hits.append(1 if test in ranked else 0)
        mrrs.append(1.0/(ranked.index(test)+1) if test in ranked else 0.0)

    return jsonify({
        "HitRate": round(np.mean(hits),4),
        "MRR":      round(np.mean(mrrs),4)
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
