import pandas as pd
import time

try:
    from main import build_cf_model, invalidate_caches
except ImportError:
    print("Function tak ditemukan")
    exit()

mat, sim, knn = build_cf_model()

if mat.empty or sim.empty or knn is None:
    print("Koneksi ke database gagal")
    exit()

user = sim.index.tolist()
if not user:
    print("Tidak ada ID pengguna ditemukan dalam matriks similarity.")
    exit()

user_id = user[4]
print(f"User ID: {user_id}")

neighbor_data = []
try:
    distances, indices = knn.kneighbors((1 - sim).loc[[user_id]].values)

    for i in range(1, len(indices[0])):
        neighbor_idx = indices[0][i]
        neighbor_id = sim.index[neighbor_idx]
        similarity_score = sim.loc[user_id, neighbor_id]
        neighbor_data.append({'ID Tetangga': neighbor_id, 'Skor Kemiripan': similarity_score})

except KeyError:
    print(f"Error: Pengguna {user_id} tidak ditemukan saat mencari tetangga.")
    exit()
except Exception as e:
    print(f"Error saat mencari tetangga: {e}")
    exit()

if neighbor_data:
    df_neighbors = pd.DataFrame(neighbor_data)
    df_neighbors_sorted = df_neighbors.sort_values(by='Skor Kemiripan', ascending=False)
    print("\nDaftar Tetangga Terdekat dan Skor Kemiripannya:")
    print(df_neighbors_sorted.to_string(index=False, float_format='{:.2f}'.format))
else:
    print("\nTidak ada tetangga yang ditemukan untuk pengguna ini.")
