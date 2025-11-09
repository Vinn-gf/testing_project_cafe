import pandas as pd
import json
import time

try:
    from main import (
        build_cf_model,
        robust_normalize_scores,
        invalidate_caches
    )
    try:
        from main import rec_ubcf_scores as get_cf_scores
    except ImportError as e:
        exit()

except ImportError as e:
    print(f"Function tak ditemukan")
    print(f"{e}")
    exit()

mat, sim, knn = build_cf_model()

if mat.empty or sim.empty or knn is None:
    print("Koneksi ke database gagal")
    exit()

user_ids = mat.index.tolist()
if not user_ids:
    print("Tidak ada ID pengguna ditemukan dalam matriks model.")
    exit()
sample_user_id = user_ids[4]
print(f"User ID: {sample_user_id}")
ubcf_raw = get_cf_scores(sample_user_id, mat, sim, knn)
cf_norm = robust_normalize_scores(ubcf_raw, pct=95)

print("\n--- OUTPUT: Skor User-Based Collaborative Filtering (UBCF) ---")
print(f"\nSkor UBCF Mentah (Top 5 Kafe):")
if ubcf_raw:
    df_ubcf_raw = pd.DataFrame(list(ubcf_raw.items()), columns=['ID Kafe', 'Skor Mentah CF'])
    df_ubcf_raw_sorted = df_ubcf_raw.sort_values(by='Skor Mentah CF', ascending=False)
    print(df_ubcf_raw_sorted.head().to_string(index=False, float_format='{:.2f}'.format))
else:
    print("Tidak ada skor CF mentah ditemukan/dihitung untuk pengguna ini.")


print(f"\nSkor UBCF Ternormalisasi (Top 5 Kafe):")
if cf_norm:
    df_cf_norm = pd.DataFrame(list(cf_norm.items()), columns=['ID Kafe', 'Skor Normal CF'])
    df_cf_norm_sorted = df_cf_norm.sort_values(by='Skor Normal CF', ascending=False)
    print(df_cf_norm_sorted.head().to_string(index=False, float_format='{:.4f}'.format))
else:
    print("Tidak ada skor CF ternormalisasi ditemukan untuk pengguna ini.")