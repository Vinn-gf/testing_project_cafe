# scripts/fix_multiline_pool.py
"""
Perbaikan CSV pool yang mengandung newline di dalam field ulasan.

Fungsi:
- Mencoba baca `data/unlabeled_pool.csv` menggunakan modul csv (yang bisa parse quoted multiline)
- Menulis ulang file ke `data/unlabeled_pool_fixed.csv`:
    - setiap record dipastikan satu baris
    - newline internal di dalam ulasan diganti menjadi spasi (bisa disesuaikan)
- Deteksi header otomatis (kolom 'ulasan' atau hanya satu kolom).
"""
import csv
import os
from pathlib import Path

IN_FILE = Path("data/unlabeled_pool.csv")
OUT_FILE = Path("data/unlabeled_pool_fixed.csv")
BACKUP_FILE = Path("data/unlabeled_pool.backup.csv")

if not IN_FILE.exists():
    raise SystemExit(f"File not found: {IN_FILE}. Pastikan data/unlabeled_pool.csv ada.")

# buat backup dulu
if not BACKUP_FILE.exists():
    IN_FILE.replace(BACKUP_FILE)
    print(f"Backup dibuat: {BACKUP_FILE}")
    # pindahkan backup kembali ke IN_FILE path untuk pembacaan di bawah
    BACKUP_FILE.replace(IN_FILE)

# kita akan coba beberapa encoding umum
encodings_to_try = ["utf-8", "utf-8-sig", "latin-1", "cp1252"]

def try_fix_with_encoding(enc):
    print(f"[try] mencoba encoding: {enc}")
    # buka file dengan newline='' agar csv.reader bisa proper handle multiline quoted fields
    with open(IN_FILE, "r", encoding=enc, errors="replace", newline='') as f:
        # sniff delimiter (best effort)
        sample = f.read(8192)
        f.seek(0)
        # basic delimiter sniff: coba koma, titik koma, tab
        delims = [',',';','\t']
        chosen = ','
        # prefer comma if sample contains quoted multiline
        if sample.count('","') > 0 or sample.count('"\n') > 0:
            chosen = ','
        else:
            # try detect most frequent delim among candidates
            counts = {d: sample.count(d) for d in delims}
            chosen = max(counts, key=counts.get)
        reader = csv.reader(f, delimiter=chosen, quotechar='"')
        rows = list(reader)  # csv.reader akan handle quoted multiline correctly
        # sanity check: ensure at least one column has long text -> assume success
        if len(rows) < 1:
            raise ValueError("CSV parse menghasilkan 0 baris")
        return rows, chosen

# try encodings until success
rows = None
used_enc = None
used_delim = None
for enc in encodings_to_try:
    try:
        rows, used_delim = try_fix_with_encoding(enc)
        used_enc = enc
        break
    except Exception as e:
        print(f"[warn] gagal pakai encoding {enc}: {e}")
        rows = None

if rows is None:
    raise SystemExit("Gagal parse file dengan encodings yang dicoba. Cek file secara manual.")

print(f"[ok] parsed {len(rows)} rows using encoding={used_enc} delim={repr(used_delim)}")

# determine header and ulasan column
header = rows[0]
ncols = len(header)
print(f"Detected header columns ({ncols}): {header}")

# heuristik: jika ada kolom bernama 'ulasan' (case-insensitive), temukan indexnya
ulasan_idx = None
for i, h in enumerate(header):
    if str(h).strip().lower() in ("ulasan","review","text","comment","isi"):
        ulasan_idx = i
        break

# if no header match and file likely has no header, assume single-column CSV and
# treat first row as data (not header). We'll test: if header row looks like 'ulasan' or 'review' use as header.
possible_header = False
if ulasan_idx is None:
    # check if first row values look like header words
    first_row = [str(x).strip().lower() for x in header]
    if any(x in ("ulasan","review","text","comment","isi") for x in first_row):
        possible_header = True
        # treat first row as header and recompute ulasan_idx
        for i, h in enumerate(first_row):
            if h in ("ulasan","review","text","comment","isi"):
                ulasan_idx = i
                break

# If still no ulasan_idx, and ncols == 1, we treat that single column as ulasan
if ulasan_idx is None and ncols == 1:
    ulasan_idx = 0
    possible_header = False  # header is actually data

# Build output rows: header will be ['ulasan'] (normalize to single column)
out_rows = []
out_header = ["ulasan"]
out_rows.append(out_header)

# start index: if possible_header True, skip first row as header; else start at 0
start_i = 1 if possible_header else 0

# For each row, take the ulasan column value, replace internal newlines with space
for r in rows[start_i:]:
    # some rows may have fewer columns due to malformed lines — guard it
    val = ""
    try:
        val = r[ulasan_idx]
    except Exception:
        # fallback: join all fields with space
        val = " ".join(r)
    # normalize newline/CR into single space
    val_clean = val.replace("\r", " ").replace("\n", " ").strip()
    # optionally collapse multiple spaces
    while "  " in val_clean:
        val_clean = val_clean.replace("  ", " ")
    out_rows.append([val_clean])

# write fixed CSV with quoting to be safe
with open(OUT_FILE, "w", encoding="utf-8-sig", newline='') as f:
    writer = csv.writer(f, delimiter=',', quotechar='"', quoting=csv.QUOTE_ALL)
    for r in out_rows:
        writer.writerow(r)

print(f"Wrote fixed pool to {OUT_FILE} (rows={len(out_rows)-1}).")
print("Selanjutnya: jalankan scripts/select_uncertain_with_hash.py atau select_uncertain.py untuk membuat to_label_round.csv lagi.")
