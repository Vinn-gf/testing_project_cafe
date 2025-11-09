import pandas as pd
import numpy as np
import json
import time

try:
    from main import fetch_all_users, safe_get, BASE 
except ImportError:
    exit()

records = []
users = fetch_all_users()
if not users:
    data_direct = safe_get(f"{BASE}/api/users") or []
    users = data_direct if isinstance(data_direct, list) else []
if not users:
    print("Error: Gagal mengambil data pengguna.")
    exit()

for u in users:
    uid = u.get("id_user") or u.get("id") or u.get("user_id")
    if uid is None: continue
    raw = u.get("menu_yang_disukai") or "[]"
    try: favs = json.loads(raw) if isinstance(raw, str) else raw
    except json.JSONDecodeError: favs = []
    if not isinstance(favs, list): favs = []
    for m in favs:
        if isinstance(m, dict) and "id_cafe" in m and "harga" in m:
            try:
                records.append({
                    "user_id": int(uid),
                    "cafe_id": int(m["id_cafe"]),
                    "harga":   int(str(m["harga"]).replace(".", ""))
                })
            except (ValueError, TypeError): pass

if not records:
    print("Tidak ada data interaksi 'menu_yang_disukai' yang valid.")
    exit()

df = pd.DataFrame(records)
try:
    mat = df.pivot_table(index="user_id", columns="cafe_id", values="harga",
                         fill_value=0, aggfunc='sum')
except Exception as e:
    print(f"{e}")
    exit()

if mat.empty:
    print("Koneksi ke database gagal atau tidak ada data tersedia.")
    exit()

print("Matriks Pengguna X Kafe (Sebelum Mean-Centering):")
num_cols_to_show_mat = min(5, mat.shape[1])
formatted_output_mat = mat.head().iloc[:, :num_cols_to_show_mat].to_string()
print(formatted_output_mat)
print("-" * 50)

X = mat.sub(mat.mean(axis=1), axis=0)

print("Matriks Pengguna X Kafe (Setelah Mean-Centering):")
num_cols_to_show_X = min(5, X.shape[1])
formatted_output_X = X.head().iloc[:, :num_cols_to_show_X].to_string(float_format='{:.2f}'.format)
print(formatted_output_X)