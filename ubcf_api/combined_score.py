import pandas as pd
import json
import time
import numpy as np

try:
    from main import (
        build_cf_model,
        rec_ubcf_scores,
        rec_visited_freq,
        rec_menu_cooccur,
        robust_normalize_scores,
        normalize_number,
        compute_sentiment_for_cafe,
        fetch_cafe,
        fetch_visited,
        _normalize_visited_list,
        build_candidate_pool_from_signals,
        invalidate_caches
    )
except ImportError as e:
    exit()

mat, sim, knn = build_cf_model()

if mat.empty or sim.empty or knn is None:
    print("Koneksi ke database gagal")
    exit()

all_user_ids = mat.index.tolist()
if not all_user_ids:
    print("ID Pengguna tidak ditemukan")
    exit()

sample_user_id = all_user_ids[4]

ubcf_raw = rec_ubcf_scores(sample_user_id, mat, sim, knn)
vf_raw = rec_visited_freq(sample_user_id)
co_raw = rec_menu_cooccur(sample_user_id)

pool = build_candidate_pool_from_signals(ubcf_raw, vf_raw, co_raw, top_n_each=50)

visited_raw = fetch_visited(sample_user_id)
seen_ids = set(_normalize_visited_list(visited_raw))
pool = [c for c in pool if c not in seen_ids]

if not pool:
    print(f"Tidak ada kafe kandidat tersisa untuk User ID {sample_user_id}")
    exit()

cf_norm = robust_normalize_scores(ubcf_raw, pct=95)
vf_norm = robust_normalize_scores(vf_raw, pct=95)
co_counts = {k: len(v) for k, v in co_raw.items()}
co_norm = robust_normalize_scores(co_counts, pct=95)

w_cf = 0.5; w_vf = 0.2; w_co =0.2; w_sent_and_rate = 0.1

rows = []
for cid in pool:
    info = fetch_cafe(cid) or {}
    cf_s = cf_norm.get(cid, 0.0)
    vf_s = vf_norm.get(cid, 0.0)
    co_s = co_norm.get(cid, 0.0)
    rating_val = info.get("rating", 0.0)
    try: rating_val_f = float(rating_val)
    except (ValueError, TypeError): rating_val_f = 0.0
    rating_n = normalize_number(rating_val_f, cap=5.0)
    sent_score = compute_sentiment_for_cafe(cid)
    sent_n = float(sent_score) if sent_score is not None else 0.5
    sent_and_rate = (sent_n + rating_n) / 2.0
    combined_score = (w_cf * cf_s + w_vf * vf_s + w_co * co_s + w_sent_and_rate * sent_and_rate)

    rows.append({
        'ID Kafe': cid,
        'Nama Kafe': info.get("nama_kafe", f"Kafe {cid}"),
        'Skor UBCF': cf_s,
        'Skor VF': vf_s,
        'Skor Menu': co_s,
        'Skor Rating': rating_n,
        'Skor Sentimen': sent_n,
        'Skor Akhir': combined_score
        })

if not rows:
    print("Tidak ada skor gabungan yang dihitung.")
    exit()

df_final = pd.DataFrame(rows)

columns_to_show = [
    'ID Kafe', 'Nama Kafe',
    'Skor UBCF', 'Skor VF', 'Skor Menu',
    'Skor Rating', 'Skor Sentimen', 'Skor Akhir'
]
formatters = {
    'Skor UBCF': lambda x: f"{x:.2f}" if pd.notna(x) else "NaN",
    'Skor VF': lambda x: f"{x:.2f}" if pd.notna(x) else "NaN",
    'Skor Menu': lambda x: f"{x:.2f}" if pd.notna(x) else "NaN",
    'Skor Rating': lambda x: f"{x:.2f}" if pd.notna(x) else "NaN",
    'Skor Sentimen': lambda x: f"{x:.2f}" if pd.notna(x) else "NaN",
    'Skor Akhir': lambda x: f"{x:.2f}" if pd.notna(x) else "NaN"
}

print(f"User ID: {sample_user_id}")
df_final_unsorted_by_id = df_final.sort_values(by='ID Kafe').reset_index(drop=True)
print(df_final_unsorted_by_id[columns_to_show].head(6).to_string(index=False, formatters=formatters))


print(f"User ID: {sample_user_id}")
df_final_sorted_by_score = df_final.sort_values(by='Skor Akhir', ascending=False).reset_index(drop=True)
df_final_sorted_by_score.insert(0, 'Peringkat', df_final_sorted_by_score.index + 1)
columns_to_show_ranked = ['Peringkat'] + columns_to_show
print(df_final_sorted_by_score[columns_to_show_ranked].head(6).to_string(index=False, formatters=formatters))