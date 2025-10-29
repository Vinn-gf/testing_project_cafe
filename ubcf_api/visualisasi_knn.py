import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
from sklearn.decomposition import PCA

# --- Import dari file main.py ---
# Pastikan visualisasi_knn.py ada di folder yang sama dengan main.py
try:
    from main import build_cf_model, fetch_all_users # Asumsi fungsi ada di main.py
except ImportError:
    print("Error: Pastikan file 'main.py' berada di direktori yang sama.")
    exit()

print("Memulai proses visualisasi KNN...")

# --- 1. Bangun Model CF dari main.py ---
print("Membangun model Collaborative Filtering (ini mungkin perlu waktu)...")
mat, sim, knn = build_cf_model()

if mat.empty or sim.empty or knn is None:
    print("Error: Gagal membangun model CF. Tidak ada data pengguna atau kafe yang cukup?")
    exit()

print(f"Model berhasil dibangun. Jumlah pengguna: {len(sim)}")

# --- 2. Pilih Pengguna Contoh ---
# Ganti dengan ID pengguna yang valid dari data Anda (harus ada di sim.index)
# Kita coba ambil pengguna pertama dari indeks similarity sebagai contoh
if not sim.index.empty:
    user_id = sim.index[4]
    print(f"Memilih pengguna contoh: ID {user_id}")
else:
    print("Error: Tidak ada pengguna dalam matriks similarity.")
    exit()

if user_id not in sim.index:
     print(f"Error: Pengguna contoh ID {user_id} tidak ditemukan dalam model.")
     # Coba lagi dengan pengguna pertama jika ID yang dipilih manual tidak ada
     if not sim.index.empty:
         user_id = sim.index[0]
         print(f"Menggunakan pengguna pertama sebagai gantinya: ID {user_id}")
     else:
        exit()


# --- 3. Dapatkan Matriks Mean-Centered (X) ---
# Kita perlu X untuk reduksi dimensi, hitung ulang dari mat
print("Menghitung matriks mean-centered (X)...")
X = mat.sub(mat.mean(axis=1), axis=0)
user_ids_in_X = X.index.tolist() # Daftar ID pengguna sesuai urutan baris X

# --- 4. Reduksi Dimensi ke 2D menggunakan PCA ---
print("Melakukan reduksi dimensi menggunakan PCA...")
n_components = 2
pca = PCA(n_components=n_components, random_state=42) # random_state untuk hasil konsisten
try:
    X_2d = pca.fit_transform(X.values) # Mengubah data X menjadi 2 dimensi
except ValueError as e:
    print(f"Error saat PCA: {e}")
    print("Mungkin jumlah pengguna/fitur kurang dari n_components?")
    exit()


# Buat DataFrame untuk koordinat 2D dengan ID pengguna
df_2d = pd.DataFrame(X_2d, columns=['PC1', 'PC2'], index=user_ids_in_X)

# --- 5. Temukan Tetangga untuk Pengguna Contoh ---
print(f"Mencari {knn.n_neighbors -1} tetangga terdekat untuk pengguna {user_id}...")
try:
    # Dapatkan jarak dan indeks K tetangga terdekat (termasuk diri sendiri)
    distances, indices = knn.kneighbors((1 - sim).loc[[user_id]].values)

    # Dapatkan ID pengguna dari indeks tetangga
    # indices[0][0] adalah diri sendiri, jadi kita ambil [1:] untuk tetangga saja
    neighbor_ids = sim.index[indices[0][1:]].tolist()
    eser_idx = sim.index.get_loc(user_id) # Dapatkan indeks baris pengguna contoh di X

    print(f"Tetangga ditemukan: {neighbor_ids}")

except KeyError:
    print(f"Error: Pengguna {user_id} tidak ditemukan saat mencari tetangga.")
    exit()
except Exception as e:
    print(f"Error saat mencari tetangga: {e}")
    exit()


# --- 6. Membuat Plot Visualisasi ---
print("Membuat plot visualisasi...")
plt.figure(figsize=(12, 8))

# Scatter plot semua pengguna (warna abu-abu)
plt.scatter(df_2d['PC1'], df_2d['PC2'], c='grey', alpha=0.5, label='Pengguna Lain')

# Tandai Pengguna Contoh (warna merah, lebih besar)
if user_id in df_2d.index:
    user_coords = df_2d.loc[user_id]
    plt.scatter(user_coords['PC1'], user_coords['PC2'], c='red', s=100, label=f'ID Pengguna Target : {user_id}', zorder=5) # zorder agar di atas
else:
     print(f"Peringatan: Koordinat 2D untuk pengguna contoh {user_id} tidak ditemukan.")


# Tandai Tetangga Terdekat (warna biru)
if neighbor_ids:
    neighbor_coords = df_2d.loc[df_2d.index.isin(neighbor_ids)]
    if not neighbor_coords.empty:
        plt.scatter(neighbor_coords['PC1'], neighbor_coords['PC2'], c='blue', s=70, label='Tetangga Terdekat', zorder=4)
    else:
        print("Peringatan: Koordinat 2D untuk tetangga tidak ditemukan.")


# --- 7. Pengaturan Plot dan Simpan Gambar ---
plt.title(f'Visualisasi KNN')
plt.xlabel('X Axis')
plt.ylabel('Y Axis')
plt.legend()
plt.grid(True, linestyle='--', alpha=0.6)

# Simpan plot sebagai file gambar
output_filename = 'knn_visualization.png'
try:
    plt.savefig(output_filename)
    print(f"Plot berhasil disimpan sebagai '{output_filename}'")
except Exception as e:
    print(f"Error saat menyimpan plot: {e}")

# Tampilkan plot (opsional, bisa di-comment jika hanya ingin menyimpan file)
# plt.show()

print("Proses visualisasi selesai.")