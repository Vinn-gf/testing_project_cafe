import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
from sklearn.decomposition import PCA

try:
    from main import build_cf_model, fetch_all_users 
except ImportError:
    print("Function tak ditemukan")
    exit()

mat, sim, knn = build_cf_model()

if mat.empty or sim.empty or knn is None:
    print("Koneksi ke database gagal")
    exit()

print(f"Model berhasil dibangun. Jumlah pengguna: {len(sim)}")

if not sim.index.empty:
    user_id = sim.index[4]
    print(f"Memilih pengguna contoh: ID {user_id}")
else:
    print("Tidak ada pengguna dalam matriks similarity.")
    exit()

if user_id not in sim.index:
     print(f"Pengguna contoh ID {user_id} tidak ditemukan dalam model.")
     if not sim.index.empty:
         user_id = sim.index[0]
         print(f"Menggunakan pengguna pertama sebagai gantinya: ID {user_id}")
     else:
        exit()


X = mat.sub(mat.mean(axis=1), axis=0)
user_ids_in_X = X.index.tolist()
n_components = 2
pca = PCA(n_components=n_components, random_state=42) 
try:
    X_2d = pca.fit_transform(X.values)
except ValueError as e:
    print(f"{e}")
    exit()


df_2d = pd.DataFrame(X_2d, columns=['PC1', 'PC2'], index=user_ids_in_X)
try:
    distances, indices = knn.kneighbors((1 - sim).loc[[user_id]].values)

    neighbor_ids = sim.index[indices[0][1:]].tolist()
    eser_idx = sim.index.get_loc(user_id)

    print(f"Tetangga ditemukan: {neighbor_ids}")

except KeyError:
    print(f"Error: Pengguna {user_id} tidak ditemukan saat mencari tetangga.")
    exit()
except Exception as e:
    print(f"Error saat mencari tetangga: {e}")
    exit()


plt.figure(figsize=(12, 8))
plt.scatter(df_2d['PC1'], df_2d['PC2'], c='grey', alpha=0.5, label='Pengguna Lain')

if user_id in df_2d.index:
    user_coords = df_2d.loc[user_id]
    plt.scatter(user_coords['PC1'], user_coords['PC2'], c='red', s=100, label=f'ID Pengguna Target : {user_id}', zorder=5) # zorder agar di atas
else:
     print(f"Peringatan: Koordinat 2D untuk id pengguna {user_id} tidak ditemukan.")


if neighbor_ids:
    neighbor_coords = df_2d.loc[df_2d.index.isin(neighbor_ids)]
    if not neighbor_coords.empty:
        plt.scatter(neighbor_coords['PC1'], neighbor_coords['PC2'], c='blue', s=70, label='Tetangga Terdekat', zorder=4)
    else:
        print("Peringatan: Koordinat 2D untuk tetangga tidak ditemukan.")


plt.title(f'Visualisasi KNN')
plt.xlabel('X Axis')
plt.ylabel('Y Axis')
plt.legend()
plt.grid(True, linestyle='--', alpha=0.6)

output_filename = 'knn_visualization.png'
try:
    plt.savefig(output_filename)
    print(f"Visualisasi berhasil disimpan sebagai '{output_filename}'")
except Exception as e:
    print(f"{e}")
