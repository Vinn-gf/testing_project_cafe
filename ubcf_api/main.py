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
# 1) Build user–item matrix from menu_yang_disukai + adjusted‑cosine + KNN
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
                        "user_id": uid,
                        "cafe_id": int(m["id_cafe"]),
                        "harga":   int(str(m["harga"]).replace(".", ""))
                    })
                except:
                    pass

    df = pd.DataFrame(records)
    if df.empty:
        return pd.DataFrame(), pd.DataFrame(), None

    mat = df.pivot_table(
        index="user_id", columns="cafe_id", values="harga", fill_value=0
    )
    # adjusted‑cosine centering
    X = mat.sub(mat.mean(axis=1), axis=0)
    num  = X.dot(X.T)
    norm = np.sqrt((X**2).sum(axis=1))
    den  = np.outer(norm, norm) + 1e-8
    sim_vals = np.divide(num.values, den,
                         out=np.zeros_like(num.values),
                         where=den>0)
    sim  = pd.DataFrame(np.clip(sim_vals, -1,1),
                        index=mat.index, columns=mat.index)
    dist = 1 - sim
    knn  = NearestNeighbors(metric="precomputed",
                            n_neighbors=min(5, len(sim)))
    knn.fit(dist.values)

    return mat, sim, knn

# ────────────────────────────────────────────────────────────────────────────────
# 2) CF prediksi harga
def rec_menu_scores(uid, mat, sim, knn):
    if knn is None or uid not in sim.index:
        return {}
    _, idxs = knn.kneighbors((1-sim).loc[[uid]].values,
                              n_neighbors=min(len(sim), 6))
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

# ────────────────────────────────────────────────────────────────────────────────
# 3) Visited‑Frequency (alur 1)
def rec_visited_freq(uid):
    seq = [v["id_cafe"] for v in fetch_visited(uid) if isinstance(v, dict)]
    trans = defaultdict(list)
    for other in fetch_all_user_ids():
        if other == uid: continue
        seq2 = [v["id_cafe"] for v in fetch_visited(other) if isinstance(v, dict)]
        for a,b in zip(seq2, seq2[1:]):
            trans[a].append(b)
    flat = sum((trans[a] for a in seq), [])
    return pd.Series(flat).value_counts().to_dict() if flat else {}

# ────────────────────────────────────────────────────────────────────────────────
# 4) Co‑occurrence menu (alur 2)
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

# ────────────────────────────────────────────────────────────────────────────────
# 5) Hybrid recommend endpoint
@app.route("/api/recommend/<int:uid>")
def api_recommend(uid):
    mat, sim, knn = build_cf_model()

    cf_raw = rec_menu_scores(uid, mat, sim, knn)
    vf_raw = rec_visited_freq(uid)
    co_raw = rec_menu_cooccur(uid)

    max_cf = max(cf_raw.values()) if cf_raw else 1.0
    max_vf = max(vf_raw.values()) if vf_raw else 1.0
    max_co = max((len(v) for v in co_raw.values()), default=1)

    pool = set(cf_raw) | set(vf_raw) | set(co_raw)
    seen = {v["id_cafe"] for v in fetch_visited(uid) if isinstance(v, dict)}
    pool = [c for c in pool if c not in seen]

    α, β, γ = 0.6, 0.2, 0.2
    rows = []
    for cid in pool:
        info = fetch_cafe(cid)
        cf_n = cf_raw.get(cid,0)/max_cf
        vf_n = vf_raw.get(cid,0)/max_vf
        co_n = len(co_raw.get(cid,[]))/max_co
        combined = α*cf_n + β*vf_n + γ*co_n
        rows.append({
            "cafe_id":      cid,
            "nama_kafe":    info.get("nama_kafe",""),
            "alamat":       info.get("alamat",""),
            "rating":       float(info.get("rating",0)),
            "score":        round(combined,6),
            "matched_menu": co_raw.get(cid,[])
        })

    dfc = pd.DataFrame(rows)
    top6 = dfc.sort_values("score", ascending=False).head(6)
    return jsonify({"recommendations": top6.to_dict("records")})

# ────────────────────────────────────────────────────────────────────────────────
# 6) Evaluate: MAE, Prec@6 & MAP@6 using hybrid recommendations
@app.route("/api/evaluate")
def api_evaluate():
    mat, sim, knn = build_cf_model()

    # —— MAE on actually‑rated items via CF‑predictions
    abs_err, sq_err = [], []
    for uid in mat.index:
        preds = rec_menu_scores(uid, mat, sim, knn)
        for cid, true_price in mat.loc[uid].items():
            if true_price > 0:
                pred_price = preds.get(cid, 0.0)
                diff = true_price - pred_price
                abs_err.append(abs(diff))
                sq_err.append(diff**2)
    mae  = float(np.mean(abs_err))  if abs_err else 0.0
    
    # —— Precision@6, MAP@6 (leave‑one‑out) via HYBRID ranking
    precisions, average_precisions = [], []
    K = 6
    for uid in fetch_all_user_ids():
        seq = [v["id_cafe"] for v in fetch_visited(uid) if isinstance(v, dict)]
        if len(seq) < 2: continue
        test_cafe = seq[-1]

        # rebuild hybrid signals
        cf_raw = rec_menu_scores(uid, mat, sim, knn)
        vf_raw = rec_visited_freq(uid)
        co_raw = rec_menu_cooccur(uid)
        max_cf = max(cf_raw.values()) if cf_raw else 1.0
        max_vf = max(vf_raw.values()) if vf_raw else 1.0
        max_co = max((len(v) for v in co_raw.values()), default=1)

        # composite pool & scores
        pool = (set(cf_raw) | set(vf_raw) | set(co_raw)) - set(seq[:-1])
        scores = {}
        for cid in pool:
            cf_n = cf_raw.get(cid,0)/max_cf
            vf_n = vf_raw.get(cid,0)/max_vf
            co_n = len(co_raw.get(cid,[]))/max_co
            scores[cid] = 0.6*cf_n + 0.2*vf_n + 0.2*co_n

        ranked = sorted(scores, key=lambda x: -scores[x])[:K]

        # precision@6
        precisions.append(1.0/K if test_cafe in ranked else 0.0)

        # AP@6: only one relevant (test_cafe)
        if test_cafe in ranked:
            idx = ranked.index(test_cafe) + 1
            ap = 1.0 / idx
        else:
            ap = 0.0
        average_precisions.append(ap)

    prec6 = float(np.mean(precisions))           if precisions           else 0.0
    map6  = float(np.mean(average_precisions))   if average_precisions   else 0.0

    return jsonify({
        "MAE":    round(mae,   4),
        "Prec@6": round(prec6, 4),
        "MAP@6":  round(map6,  4),
    })

if __name__=="__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
