# main.py

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


# ── 1) Build user–item matrix from menu_yang_disukai ─────────────────────────────
records = []
for uid in fetch_all_user_ids():
    u   = fetch_user(uid)
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
    mat = pd.DataFrame()
else:
    mat = df.pivot_table(
        index="user_id", columns="cafe_id", values="harga", fill_value=0
    )

# ── 2) Compute adjusted cosine similarity + build KNN ───────────────────────────
NEIGHBORS = 10
if not mat.empty and mat.shape[0] > 1:
    X    = mat.sub(mat.mean(axis=1), axis=0)
    num  = X.dot(X.T)
    norm = np.sqrt((X**2).sum(axis=1))
    den  = np.outer(norm, norm) + 1e-8
    sim_vals = np.divide(num.values, den, out=np.zeros_like(num.values), where=den>0)
    sim = pd.DataFrame(np.clip(sim_vals, -1,1), index=mat.index, columns=mat.index)
    dist = 1 - sim
    knn  = NearestNeighbors(metric="precomputed",
                            n_neighbors=min(NEIGHBORS, len(sim)))
    knn.fit(dist.values)
else:
    sim = pd.DataFrame(); knn = None


# ── 3) rec_menu (CF) for items not yet rated ────────────────────────────────────
def rec_menu(uid, K=10):
    if knn is None or uid not in sim.index:
        return []
    _, idxs = knn.kneighbors((1-sim).loc[[uid]].values,
                              n_neighbors=min(len(sim), K+1))
    neigh = sim.index[idxs[0][1:]]  # exclude self
    scores = {}
    for cid in mat.columns:
        if mat.loc[uid, cid] == 0:
            num_ = sum(sim.loc[uid, u] * mat.loc[u, cid] for u in neigh)
            den_ = sum(abs(sim.loc[uid, u]) for u in neigh)
            val = num_/den_ if den_>0 else 0
            if val>0: scores[cid] = val
    return sorted(scores, key=scores.get, reverse=True)[:K]


# ── 4) rec_visited (transition freq) ────────────────────────────────────────────
def rec_visited(uid):
    seq = [int(v["id_cafe"]) for v in fetch_visited(uid) if isinstance(v, dict)]
    trans = defaultdict(list)
    for other in fetch_all_user_ids():
        if other == uid: continue
        seq2 = [int(v["id_cafe"]) for v in fetch_visited(other) if isinstance(v, dict)]
        for a,b in zip(seq2, seq2[1:]):
            trans[a].append(b)
    flat = sum((trans[a] for a in seq), [])
    return pd.Series(flat).value_counts().to_dict() if flat else {}


# ── 5) Composite recommendation endpoint ────────────────────────────────────────
@app.route("/api/recommend/<int:uid>")
def api_recommend(uid):
    try:
        _ = fetch_user(uid)
        K_rec = 10
        pool_factor = 3  # pool size = 3 * K_rec
        α, β, γ = 0.5, 0.4, 0.1

        menu_cands = rec_menu(uid, pool_factor*K_rec)
        visit_freq = rec_visited(uid)
        visit_cands = sorted(visit_freq, key=visit_freq.get, reverse=True)[:pool_factor*K_rec]

        pool = list(dict.fromkeys(menu_cands + visit_cands))
        seen = {v["id_cafe"] for v in fetch_visited(uid) if isinstance(v, dict)}
        pool = [c for c in pool if c not in seen]

        rows = []
        max_freq = max(visit_freq.values()) if visit_freq else 1
        for cid in pool:
            info = fetch_cafe(cid)
            if not isinstance(info, dict): continue
            # menu_score = 1/rank
            menu_score = (1.0/(menu_cands.index(cid)+1)
                          if cid in menu_cands else 0.0)
            # visited_score = freq/max_freq
            visited_score = (visit_freq.get(cid,0)/max_freq)
            # rating_score = normalized [0..1]
            rating_score = float(info.get("rating",0))/5.0
            score = α*menu_score + β*visited_score + γ*rating_score
            rows.append({
                "cafe_id":   cid,
                "nama_kafe": info.get("nama_kafe",""),
                "alamat":    info.get("alamat",""),
                "rating":    float(info.get("rating",0)),
                "score":     score
            })

        dfc = pd.DataFrame(rows)
        if dfc.empty:
            return jsonify({"recommendations": []})
        dfc = dfc.sort_values(["score","rating"], ascending=[False,False]).head(K_rec)
        out = dfc.to_dict("records")
        for r in out: r["score"] = float(round(r["score"],6))
        return jsonify({"recommendations": out})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── 6) Composite Next‐Item evaluation ───────────────────────────────────────────
@app.route("/api/evaluate")
def api_evaluate():
    try:
        K_eval = 10
        α, β, γ = 0.5, 0.4, 0.1
        hits, mrrs = [], []

        for uid in fetch_all_user_ids():
            seq = [int(v["id_cafe"]) for v in fetch_visited(uid) if isinstance(v, dict)]
            if len(seq)<2: continue
            test = seq[-1]
            hist = seq[:-1]

            # build pool same as recommend, but filter only seen_before_test
            pool_factor=3
            menu_cands = rec_menu(uid, pool_factor*K_eval)
            visit_freq = rec_visited(uid)
            visit_cands = sorted(visit_freq, key=visit_freq.get, reverse=True)[:pool_factor*K_eval]
            pool = list(dict.fromkeys(menu_cands + visit_cands))
            seen_before = set(hist)
            pool = [c for c in pool if c not in seen_before]

            # score them
            max_freq = max(visit_freq.values()) if visit_freq else 1
            scored=[]
            for cid in pool:
                menu_score = (1.0/(menu_cands.index(cid)+1) if cid in menu_cands else 0.0)
                visited_score = visit_freq.get(cid,0)/max_freq
                rating_score = float(fetch_cafe(cid).get("rating",0))/5.0
                scored.append((cid, α*menu_score+β*visited_score+γ*rating_score))
            if not scored:
                hits.append(0); mrrs.append(0.0); continue

            ranked = [cid for cid,_ in sorted(scored, key=lambda x:-x[1])]
            if test in ranked:
                hits.append(1)
                mrrs.append(1.0/(ranked.index(test)+1))
            else:
                hits.append(0); mrrs.append(0.0)

        return jsonify({
            "HitRate": round(np.mean(hits),4),
            "MRR":     round(np.mean(mrrs),4)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__=="__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
