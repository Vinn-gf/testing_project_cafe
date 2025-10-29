import pandas as pd
import json
import time

try:
    from main import (
        build_cf_model,
        rec_visited_freq,
        rec_menu_cooccur,
        invalidate_caches
    )
except ImportError:
    print("Error: Pastikan file 'main.py' berada di direktori yang sama.")
    exit()

mat, _, _ = build_cf_model()

if mat.empty:
    print("Error: Gagal membangun model. Tidak ada pengguna valid?")
    exit()

user = mat.index.tolist()
if not user:
    print("Error: Tidak ada ID pengguna ditemukan dalam matriks.")
    exit()

user_id = user[4] 

vf_raw = rec_visited_freq(user_id)

menu_raw = rec_menu_cooccur(user_id)
menu_counts = {k: len(v) for k, v in menu_raw.items()}

print("-" * 50)
print(f"User ID: {user_id}")

print(f"\nSkor Visited Frequency Mentah (Belum normalisasi):")
if vf_raw:
    df_vf = pd.DataFrame(list(vf_raw.items()), columns=['ID Kafe', 'Skor Visited Frequency'])
    df_vf_sorted = df_vf.sort_values(by='Skor Visited Frequency', ascending=False)
    print(df_vf_sorted.head().to_string(index=False))
else:
    print("Tidak ada skor VF ditemukan untuk pengguna ini.")

print(f"\nSkor Menu Yang Disukai (Belum normalisasi):")
if menu_counts:
    df_co = pd.DataFrame(list(menu_counts.items()), columns=['ID Kafe', 'Skor Menu Yang Disukai'])
    df_co_sorted = df_co.sort_values(by='Skor Menu Yang Disukai', ascending=False)
    print(df_co_sorted.head().to_string(index=False))

    top_co_cafe_id = df_co_sorted.iloc[0]['ID Kafe']
    print(f"\nDetail Menu Cocok (Contoh Kafe ID {top_co_cafe_id} - Skor Menu: {df_co_sorted.iloc[0]['Skor Menu Yang Disukai']}):")
    print(f"{menu_raw.get(top_co_cafe_id, ['N/A'])[:5]}...")
else:
    print("Tidak ada skor CO ditemukan untuk pengguna ini.")

print("-" * 50)
print("Proses selesai.")