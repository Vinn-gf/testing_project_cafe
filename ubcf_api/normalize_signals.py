import pandas as pd
import json
import time

try:
    from main import (
        build_cf_model,
        rec_visited_freq,
        rec_menu_cooccur,
        robust_normalize_scores,
        invalidate_caches
    )
    try:
        from main import rec_ubcf_scores as get_cf_scores
    except ImportError:
        from main import rec_menu_scores as get_cf_scores

except ImportError as e:
    print(f"Error: Gagal mengimpor fungsi dari 'main.py'. Pastikan file ada di direktori yang sama.")
    print(f"Detail error: {e}")
    exit()

mat, sim, knn = build_cf_model()

if mat.empty or sim.empty or knn is None:
    print("Error: Gagal membangun model CF awal. Periksa koneksi backend atau data.")
    exit()

user = mat.index.tolist()
if not user:
    print("Error: Tidak ada ID pengguna ditemukan dalam matriks model.")
    exit()

user_id = user[4]
print("-" * 50)

vf_raw = rec_visited_freq(user_id)
co_raw = rec_menu_cooccur(user_id)
co_counts = {k: len(v) for k, v in co_raw.items()}

vf_norm = robust_normalize_scores(vf_raw, pct=95)
co_norm = robust_normalize_scores(co_counts, pct=95)

print("-" * 50)
print(f"User ID: {user_id}")

print(f"\nSkor Visited Frequency Ternormalisasi:")
if vf_norm:
    df_vf_norm = pd.DataFrame(list(vf_norm.items()), columns=['ID Kafe', 'Skor Visited Frequency'])
    df_vf_norm_sorted = df_vf_norm.sort_values(by='Skor Visited Frequency', ascending=False)
    print(df_vf_norm_sorted.head().to_string(index=False, float_format='{:.2f}'.format))
else:
    print("Tidak ada skor Visited Frequency ditemukan untuk pengguna ini.")

print(f"\nSkor Menu Yang Disukai Setelah Normalisasi:")
if co_norm:
    df_co_norm = pd.DataFrame(list(co_norm.items()), columns=['ID Kafe', 'Skor Menu Yang Disukai'])
    df_co_norm_sorted = df_co_norm.sort_values(by='Skor Menu Yang Disukai', ascending=False)
    print(df_co_norm_sorted.head().to_string(index=False, float_format='{:.2f}'.format))
else:
    print("Tidak ada skor Menu Yang Disukai ditemukan untuk pengguna ini.")

print("-" * 50)
print("Proses selesai.")