# visited_sequence.py
# Hitung kafe yang paling sering dikunjungi SETELAH sebuah kafe sumber.
# Contoh pakai:
#   python visited_sequence.py --base http://127.0.0.1:8080 --cafe 20
#   python visited_sequence.py --base http://127.0.0.1:8080 --cafe 20 --top 15 --format json

import argparse
import json
import os
import sys
from typing import Any, Dict, List, Tuple

import requests


def safe_get_json(url: str, timeout: int = 8) -> Any:
    """GET JSON yang toleran error (termasuk fallback http untuk ngrok https)."""
    try:
        r = requests.get(url, headers={"ngrok-skip-browser-warning": "true"}, timeout=timeout)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.SSLError:
        # fallback jika pakai ngrok https → http
        if url.startswith("https://"):
            alt = "http://" + url[len("https://") :]
            try:
                r2 = requests.get(alt, headers={"ngrok-skip-browser-warning": "true"}, timeout=timeout)
                r2.raise_for_status()
                return r2.json()
            except Exception:
                return None
        return None
    except Exception:
        return None


def fetch_all_users(base: str) -> List[Dict[str, Any]]:
    """Ambil semua user dari BASE/api/users (list of dict)."""
    data = safe_get_json(f"{base.rstrip('/')}/api/users")
    return data if isinstance(data, list) else []


def fetch_cafe(base: str, cid: int) -> Dict[str, Any]:
    """Ambil detail kafe dari BASE/api/cafe/{id}. Jika tidak ada, coba cari di daftar /api/data."""
    # coba langsung endpoint detail
    data = safe_get_json(f"{base.rstrip('/')}/api/cafe/{cid}")
    if isinstance(data, dict) and data:
        return data

    # fallback: cari di list /api/data
    arr = safe_get_json(f"{base.rstrip('/')}/api/data")
    if isinstance(arr, list):
        for c in arr:
            try:
                # kolom kemungkinan: nomor / id_cafe / id
                if int(c.get("nomor", c.get("id_cafe", c.get("id", -999)))) == int(cid):
                    return c
            except Exception:
                continue
    return {}


def _normalize_visited_list(raw_vis: Any) -> List[int]:
    """
    Normalisasi format 'cafe_telah_dikunjungi' menjadi list[int] id_kafe.
    Mendukung:
      - List of dicts: [{"id_cafe": 12, ...}, ...]
      - JSON string list serupa, atau string "1,2,3"
      - List of ints (langsung)
    """
    out: List[int] = []
    if raw_vis is None:
        return out

    # jika sudah list
    if isinstance(raw_vis, list):
        items = raw_vis
    elif isinstance(raw_vis, str):
        raw = raw_vis.strip()
        # coba parse json
        if raw.startswith("[") and raw.endswith("]"):
            try:
                parsed = json.loads(raw)
                items = parsed if isinstance(parsed, list) else []
            except Exception:
                items = []
        else:
            # fallback: parse "1,2,3"
            if "," in raw:
                items = [s.strip() for s in raw.split(",") if s.strip()]
            else:
                items = []
    else:
        return out

    for it in items:
        if isinstance(it, dict):
            # cari field id kafe umum
            for k in ("id_cafe", "nomor", "cafe_id", "id"):
                if k in it and it[k] not in (None, ""):
                    try:
                        out.append(int(it[k]))
                    except Exception:
                        pass
                    break
        else:
            try:
                out.append(int(it))
            except Exception:
                pass
    return out


def counts_after_cafe(base: str, source_cafe_id: int) -> List[Tuple[int, int]]:
    """
    Hitung berapa kali setiap kafe muncul sebagai kunjungan segera SETELAH 'source_cafe_id'
    berdasarkan urutan kunjungan seluruh user (kecuali entri rusak).
    Return: list tuple (id_kafe_tujuan, jumlah), BELUM ada nama.
    """
    try:
        src = int(source_cafe_id)
    except Exception:
        return []

    users = fetch_all_users(base)
    counts: Dict[int, int] = {}

    for u in users:
        # ambil berbagai kemungkinan lokasi field
        raw = (
            u.get("cafe_telah_dikunjungi")
            or u.get("visited")
            or u.get("cafe_telah_dikunjungi", "[]")
        )
        seq = _normalize_visited_list(raw)

        # transisi berurutan (a -> b)
        for a, b in zip(seq, seq[1:]):
            try:
                if int(a) == src:
                    b = int(b)
                    counts[b] = counts.get(b, 0) + 1
            except Exception:
                continue

    # list & urutkan desc jumlah, lalu asc id
    return sorted(counts.items(), key=lambda x: (-x[1], x[0]))


def attach_names(base: str, pairs: List[Tuple[int, int]]) -> List[Dict[str, Any]]:
    """Lengkapi (id, count) dengan nama kafe dari API."""
    results: List[Dict[str, Any]] = []
    for cid, cnt in pairs:
        info = fetch_cafe(base, cid) or {}
        nama = info.get("nama_kafe") or info.get("nama") or f"Kafe {cid}"
        results.append(
            {"id_kafe": cid, "nama_kafe": nama, "jumlah_kunjungan_setelah": int(cnt)}
        )
    return results


def print_table(rows: List[Dict[str, Any]], top: int = 10) -> None:
    """Cetak tabel sederhana ke stdout."""
    head = ["ID Kafe", "Nama Kafe", "Jumlah Kunjungan Setelah"]
    print(f"{head[0]:<10}  {head[1]:<40}  {head[2]:>26}")
    print("-" * 10 + "  " + "-" * 40 + "  " + "-" * 26)
    for r in rows[:top]:
        print(f"{str(r['id_kafe']):<10}  {str(r['nama_kafe'])[:40]:<40}  {str(r['jumlah_kunjungan_setelah']):>26}")


def main():
    parser = argparse.ArgumentParser(
        description="Hitung kafe yang sering dikunjungi SETELAH kafe sumber."
    )
    parser.add_argument(
        "--base",
        type=str,
        default=os.environ.get("BASE_URL", "http://127.0.0.1:8080"),
        help="Base URL backend (default: http://127.0.0.1:8080 atau env BASE_URL)",
    )
    parser.add_argument(
        "--cafe", type=int, required=True, help="ID kafe sumber, mis. 20"
    )
    parser.add_argument(
        "--top",
        type=int,
        default=10,
        help="Banyaknya baris teratas untuk ditampilkan (default: 10)",
    )
    parser.add_argument(
        "--format",
        type=str,
        choices=["table", "json"],
        default="table",
        help="Format keluaran (table/json). Default: table",
    )

    args = parser.parse_args()
    base = args.base.rstrip("/")
    source_cafe_id = args.cafe

    pairs = counts_after_cafe(base, source_cafe_id)
    rows = attach_names(base, pairs)

    if args.format == "json":
        print(json.dumps({"source_cafe_id": source_cafe_id, "results": rows}, ensure_ascii=False, indent=2))
    else:
        print(f"Sumber: Kafe ID {source_cafe_id} | BASE = {base}")
        if not rows:
            print("Tidak ada data transisi setelah kafe sumber atau data pengguna kosong.")
            sys.exit(0)
        print_table(rows, top=args.top)


if __name__ == "__main__":
    main()
