#!/usr/bin/env python3
"""
check_visit.py

Hitung berapa kali masing-masing kafe dikunjungi (menggunakan data dari endpoint /api/users).
Output contoh:
    Tepat Waktu Kopi : 10 kunjungan
    Kala Rindu        : 5 kunjungan
    ...
    Total Kunjungan user ke kafe : 200 data

Usage:
    python check_visit.py
    python check_visit.py --base http://127.0.0.1:8080 --top 20

Script toleran terhadap format visited yang umum:
 - user["cafe_telah_dikunjungi"] bisa list atau JSON-string
 - item visited bisa dict dengan kunci 'id_cafe','nomor','id' atau scalar int/string
"""
from __future__ import annotations
import requests
import json
import argparse
from typing import Any, Dict, List, Tuple, Union
from collections import Counter, defaultdict

DEFAULT_BASE = "http://127.0.0.1:8080"
DEFAULT_TIMEOUT = 8.0
HEADERS = {"ngrok-skip-browser-warning": "true", "Accept": "application/json"}


def safe_get_json(url: str, timeout: float = DEFAULT_TIMEOUT) -> Any:
    """GET request with basic error handling. Returns parsed JSON or None."""
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout)
        r.raise_for_status()
        try:
            return r.json()
        except ValueError:
            text = r.text.strip()
            try:
                return json.loads(text)
            except Exception:
                return None
    except requests.exceptions.SSLError:
        # try http fallback for ngrok-like hosts
        if url.startswith("https://"):
            alt = "http://" + url[len("https://"):]
            try:
                r2 = requests.get(alt, headers=HEADERS, timeout=timeout)
                r2.raise_for_status()
                try:
                    return r2.json()
                except ValueError:
                    return json.loads(r2.text)
            except Exception:
                return None
    except Exception:
        return None


def extract_cafe_id_from_obj(obj: Dict[str, Any]) -> Union[int, None]:
    """Try common id fields from a cafe object."""
    for k in ("nomor", "id_cafe", "id", "nomor_kafe"):
        if k in obj and obj[k] not in (None, ""):
            try:
                return int(obj[k])
            except Exception:
                return None
    return None


def extract_cafe_name_from_obj(obj: Dict[str, Any]) -> str:
    for k in ("nama_kafe", "name", "nama", "title"):
        if k in obj and obj[k] not in (None, ""):
            return str(obj[k])
    # fallback to alamat or unknown
    return str(obj.get("alamat", "Unknown"))


def normalize_visited_item(item: Any) -> Union[int, str, None]:
    """
    Return an identifier for visited item:
      - prefer integer cafe id if present
      - else return name string if present in dict
      - else if scalar int/string try to convert to int then fallback to string
    """
    if item is None:
        return None
    if isinstance(item, dict):
        # try id keys
        for k in ("id_cafe", "nomor", "cafe_id", "id"):
            if k in item and item[k] not in (None, ""):
                try:
                    return int(item[k])
                except Exception:
                    return str(item[k])
        # try name keys
        for k in ("nama_kafe", "name", "nama", "title"):
            if k in item and item[k] not in (None, ""):
                return str(item[k])
        # otherwise unknown dict
        return None
    # scalar
    if isinstance(item, (int, float)):
        try:
            return int(item)
        except:
            return str(item)
    if isinstance(item, str):
        # try parse json scalar
        s = item.strip()
        # try parse as JSON array/object (should not happen here), else comma-separated ids
        if s.startswith("[") or s.startswith("{"):
            try:
                parsed = json.loads(s)
                # we won't handle nested here; caller handles lists
                return None
            except:
                pass
        # try int scalar
        try:
            return int(s)
        except:
            return s
    return None


def parse_visited_field(raw: Any) -> List[Union[int, str]]:
    """
    Given user['cafe_telah_dikunjungi'] which may be list or JSON-string,
    return list of normalized identifiers (ints or strings).
    """
    if raw is None:
        return []
    items = []
    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, str):
        s = raw.strip()
        # try parse JSON
        try:
            parsed = json.loads(s)
            if isinstance(parsed, list):
                items = parsed
            else:
                # maybe comma separated "1,2,3" or "62, 17"
                if "," in s:
                    items = [x.strip() for x in s.split(",") if x.strip()]
                else:
                    items = []
        except Exception:
            if "," in s:
                items = [x.strip() for x in s.split(",") if x.strip()]
            else:
                items = []
    else:
        # unknown type -> ignore
        return []

    out = []
    for it in items:
        nid = normalize_visited_item(it)
        if nid is not None:
            out.append(nid)
    return out


def build_cafe_name_map(cafes: List[Dict[str, Any]]) -> Tuple[Dict[int, Dict[str, Any]], Dict[str, int]]:
    """
    Build:
      - cafes_by_id: int id -> original cafe dict
      - name_to_id: lower-name -> id (first occurrence)
    """
    cafes_by_id: Dict[int, Dict[str, Any]] = {}
    name_to_id: Dict[str, int] = {}
    for c in cafes:
        cid = extract_cafe_id_from_obj(c)
        name = extract_cafe_name_from_obj(c)
        if cid is not None:
            cafes_by_id[cid] = c
            if name and name.lower() not in name_to_id:
                name_to_id[name.lower()] = cid
        else:
            # cafe without numeric id: map by name string (if unique)
            if name and name.lower() not in name_to_id:
                # reserve negative hashed id (not strictly necessary)
                name_to_id[name.lower()] = -len(name_to_id) - 1
    return cafes_by_id, name_to_id


def main():
    p = argparse.ArgumentParser(description="Hitung jumlah kunjungan user ke masing-masing kafe (dari /api/users).")
    p.add_argument("--base", "-b", default=DEFAULT_BASE, help=f"Base URL backend (default: {DEFAULT_BASE})")
    p.add_argument("--top", "-t", type=int, default=0, help="Tampilkan only top N kafe (default 0 = semua)")
    args = p.parse_args()

    base = args.base.rstrip("/")

    cafes_data = safe_get_json(f"{base}/api/data")
    users_data = safe_get_json(f"{base}/api/users")

    if cafes_data is None:
        print(f"WARNING: gagal fetch /api/data dari {base}/api/data. Melanjutkan tanpa nama kafe lengkap.")
        cafes = []
    else:
        # accept list or {data: [...]}
        if isinstance(cafes_data, dict) and "data" in cafes_data and isinstance(cafes_data["data"], list):
            cafes = cafes_data["data"]
        elif isinstance(cafes_data, list):
            cafes = cafes_data
        else:
            cafes = []

    if users_data is None:
        print(f"ERROR: gagal fetch /api/users dari {base}/api/users. Tidak ada data pengguna.")
        return
    else:
        if isinstance(users_data, dict) and "data" in users_data and isinstance(users_data["data"], list):
            users = users_data["data"]
        elif isinstance(users_data, list):
            users = users_data
        else:
            users = []

    cafes_by_id, name_to_id = build_cafe_name_map(cafes)

    # counts keyed by either int id or string name
    counts = Counter()
    total_visits = 0

    for u in users:
        # try common visited fields
        raw = None
        for f in ("cafe_telah_dikunjungi", "visited", "visited_cafes"):
            if f in u:
                raw = u[f]
                break
        if raw is None:
            # try any field containing "visit"
            for k, v in u.items():
                if "visit" in k.lower():
                    raw = v
                    break
        visited_list = parse_visited_field(raw)
        for vid in visited_list:
            # if vid is string and matches known cafe name, convert to id
            key = vid
            if isinstance(vid, str):
                low = vid.strip().lower()
                if low in name_to_id:
                    mapped = name_to_id[low]
                    key = mapped
                else:
                    # try to match any cafe name partially (best-effort)
                    matched = None
                    for cname_lower, cid in name_to_id.items():
                        if cname_lower == low or low in cname_lower or cname_lower in low:
                            matched = cid
                            break
                    if matched is not None:
                        key = matched
                    else:
                        key = vid  # keep string
            counts[key] += 1
            total_visits += 1

    # prepare printable list: convert keys to display names
    display = []
    for k, v in counts.items():
        if isinstance(k, int):
            # numeric id -> lookup name
            name = None
            if k in cafes_by_id:
                name = extract_cafe_name_from_obj(cafes_by_id[k])
            else:
                # if not in cafes_by_id but maybe negative placeholder mapped by name_to_id?
                # try find name in name_to_id
                found = None
                for nm, cid in name_to_id.items():
                    if cid == k:
                        found = nm
                        break
                if found:
                    name = found
            if not name:
                name = str(k)
        else:
            name = str(k)
        display.append((name, v))

    # sort by count desc
    display.sort(key=lambda x: -x[1])

    # apply top filter
    if args.top and args.top > 0:
        display = display[: args.top]

    # print results
    for name, cnt in display:
        print(f"{name} : {cnt} kunjungan")

    print()
    print(f"Total Kunjungan user ke kafe : {total_visits} data")


if __name__ == "__main__":
    main()
