import pandas as pd
import json
import time

# --- Import Fungsi dari main.py ---
try:
    from main import (
        build_cf_model,
        robust_normalize_scores, # Fungsi normalisasi
        invalidate_caches
    )
    # Import fungsi skor CF, coba nama baru dulu
    try:
        from main import rec_ubcf_scores as get_cf_scores
    except ImportError:
        # Fallback ke nama lama jika belum diubah
        from main import rec_menu_scores as get_cf_scores

except ImportError as e:
    print(f"Error: Gagal mengimpor fungsi dari 'main.py'. Pastikan file ada di direktori yang sama.")
    print(f"Detail error: {e}")
    exit()

print("Memulai proses untuk menampilkan output Skor UBCF (Mentah & Ternormalisasi)...")
print("-" * 50)

# --- (Opsional) Invalidasi Cache ---
# invalidate_caches()
# time.sleep(2)

# --- Bangun Model Lengkap ---
print("Membangun model dasar CF (mat, sim, knn)...")
mat, sim, knn = build_cf_model()

if mat.empty or sim.empty or knn is None:
    print("Error: Gagal membangun model CF awal. Periksa koneksi backend atau data.")
    exit()

user_ids = mat.index.tolist()
if not user_ids:
    print("Error: Tidak ada ID pengguna ditemukan dalam matriks model.")
    exit()

# --- Pilih Contoh Pengguna ---
sample_user_id = user_ids[2] # Ambil pengguna pertama
print(f"Menggunakan Sample User ID: {sample_user_id}")
print("-" * 50)

# --- 1. Hitung Skor UBCF Mentah ---
print("Menghitung skor UBCF mentah (cf_raw)...")
cf_raw = get_cf_scores(sample_user_id, mat, sim, knn)

# --- 2. Lakukan Normalisasi Skor UBCF ---
print("Melakukan normalisasi robust untuk skor UBCF...")
cf_norm = robust_normalize_scores(cf_raw, pct=95)

print("-" * 50)
# --- Tampilkan Output dalam Tabel ---
print("\n--- OUTPUT: Skor User-Based Collaborative Filtering (UBCF) ---")
print(f"Untuk User ID: {sample_user_id}")

# --- Tabel CF Mentah ---
print(f"\nSkor UBCF Mentah (Top 5 Kafe):")
if cf_raw:
    df_cf_raw = pd.DataFrame(list(cf_raw.items()), columns=['ID Kafe', 'Skor Mentah CF'])
    df_cf_raw_sorted = df_cf_raw.sort_values(by='Skor Mentah CF', ascending=False)
    # Format skor menjadi 2 angka desimal (atau sesuai rentang aslinya)
    print(df_cf_raw_sorted.head().to_string(index=False, float_format='{:.2f}'.format))
else:
    print("Tidak ada skor CF mentah ditemukan/dihitung untuk pengguna ini.")


# --- Tabel CF Ternormalisasi ---
print(f"\nSkor UBCF Ternormalisasi (Top 5 Kafe):")
if cf_norm:
    df_cf_norm = pd.DataFrame(list(cf_norm.items()), columns=['ID Kafe', 'Skor Normal CF'])
    df_cf_norm_sorted = df_cf_norm.sort_values(by='Skor Normal CF', ascending=False)
    # Format skor menjadi 4 angka desimal
    print(df_cf_norm_sorted.head().to_string(index=False, float_format='{:.4f}'.format))
else:
    print("Tidak ada skor CF ternormalisasi ditemukan untuk pengguna ini.")

print("-" * 50)
print("Proses selesai.")