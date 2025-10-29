import pandas as pd
import json
import time
import numpy as np

# --- Import Fungsi yang BENAR dari main.py ---
try:
    from main import (
        build_cf_model,
        rec_ubcf_scores, # Atau rec_menu_scores jika itu nama aslinya
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
    print(f"Error: Gagal mengimpor fungsi dari 'main.py'. Pastikan file ada di direktori yang sama.")
    print(f"Detail error: {e}")
    exit()

print("Memulai proses untuk menampilkan output Skor Gabungan (Weighted Sum)...")
print("-" * 50)

# --- (Opsional) Invalidasi Cache ---
# invalidate_caches(clear_sentiment=True)
# time.sleep(2)

# --- Bangun Model CF Dasar ---
print("Membangun model Collaborative Filtering (mat, sim, knn)...")
mat, sim, knn = build_cf_model()

if mat.empty or sim.empty or knn is None:
    print("Error: Gagal membangun model CF awal. Periksa koneksi backend atau data.")
    exit()

all_user_ids = mat.index.tolist()
if not all_user_ids:
    print("Error: Tidak ada ID pengguna ditemukan dalam matriks model.")
    exit()

# --- Pilih Pengguna Target ---
sample_user_id = all_user_ids[4] # Ambil pengguna pertama sebagai contoh
print(f"Menggunakan Pengguna Target ID: {sample_user_id}")
print("-" * 50)

# --- Hitung Sinyal Mentah ---
print("Menghitung sinyal mentah (CF, VF, CO)...")
cf_raw = rec_ubcf_scores(sample_user_id, mat, sim, knn)
vf_raw = rec_visited_freq(sample_user_id)
co_raw = rec_menu_cooccur(sample_user_id)

# --- Bangun Pool Kandidat ---
print("Membangun pool kandidat...")
pool = build_candidate_pool_from_signals(cf_raw, vf_raw, co_raw, top_n_each=50)

# --- Filter Kafe yang Sudah Dikunjungi ---
print("Memfilter kafe yang sudah dikunjungi...")
visited_raw = fetch_visited(sample_user_id)
seen_ids = set(_normalize_visited_list(visited_raw))
pool = [c for c in pool if c not in seen_ids]

if not pool:
    print(f"Error: Tidak ada kafe kandidat tersisa untuk User ID {sample_user_id} setelah filtering.")
    exit()

print(f"Jumlah kandidat setelah filter: {len(pool)}")
print("-" * 50)

# --- Normalisasi Skor Sinyal ---
print("Normalisasi skor sinyal (CF, VF, CO)...")
cf_norm = robust_normalize_scores(cf_raw, pct=95)
vf_norm = robust_normalize_scores(vf_raw, pct=95)
co_counts = {k: len(v) for k, v in co_raw.items()}
co_norm = robust_normalize_scores(co_counts, pct=95)

# --- Inisialisasi Bobot ---
w_cf = 0.5; w_vf = 0.2; w_co =0.2; w_sent_and_rate = 0.1

# --- Proses Penggabungan Skor ---
print("Menggabungkan semua skor dengan Weighted Sum...")
print("" * 50)
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
        # 'Matched Menu (CO)' bisa ditambahkan jika perlu
    })

if not rows:
    print("Tidak ada skor gabungan yang dihitung.")
    exit()

# Buat DataFrame dari hasil
df_final = pd.DataFrame(rows)

# --- Tentukan Kolom dan Formatter ---
columns_to_show = [
    'ID Kafe', 'Nama Kafe',
    'Skor UBCF', 'Skor VF', 'Skor Menu',
    'Skor Rating', 'Skor Sentimen', 'Skor Akhir'
]
formatters = {
    'Skor UBCF': lambda x: f"{x:.4f}" if pd.notna(x) else "NaN",
    'Skor VF': lambda x: f"{x:.4f}" if pd.notna(x) else "NaN",
    'Skor Menu': lambda x: f"{x:.4f}" if pd.notna(x) else "NaN",
    'Skor Rating': lambda x: f"{x:.4f}" if pd.notna(x) else "NaN",
    'Skor Sentimen': lambda x: f"{x:.4f}" if pd.notna(x) else "NaN",
    'Skor Akhir': lambda x: f"{x:.4f}" if pd.notna(x) else "NaN"
}

print(f"User ID: {sample_user_id}")
# Urutkan DataFrame berdasarkan ID Kafe
df_final_unsorted_by_id = df_final.sort_values(by='ID Kafe').reset_index(drop=True)
# Tampilkan beberapa baris pertama (misal 10)
print(df_final_unsorted_by_id[columns_to_show].head(6).to_string(index=False, formatters=formatters))


print("" * 50)
# --- 2. Tampilkan Output TERURUT (Top 6 berdasarkan Skor Akhir) ---
print(f"User ID: {sample_user_id}")
# Urutkan DataFrame berdasarkan Skor Akhir
df_final_sorted_by_score = df_final.sort_values(by='Skor Akhir', ascending=False).reset_index(drop=True)
# Tambahkan kolom Peringkat
df_final_sorted_by_score.insert(0, 'Peringkat', df_final_sorted_by_score.index + 1)
# Update columns_to_show untuk menyertakan Peringkat
columns_to_show_ranked = ['Peringkat'] + columns_to_show
# Tampilkan Top 6
print(df_final_sorted_by_score[columns_to_show_ranked].head(6).to_string(index=False, formatters=formatters))


print("" * 50)