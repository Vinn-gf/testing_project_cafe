# scripts/fix_garbled_csv.py
import pandas as pd
import os

IN_FILE = "data/labeled_all.csv"  # example
OUT_FILE = "data/labeled_all_fixed.csv"

def try_fix_text(s):
    if not isinstance(s, str):
        return s
    # detect common mojibake characters
    if "�" in s or "ð" in s or "â" in s:
        try:
            return s.encode("latin-1").decode("utf-8")
        except Exception:
            try:
                return s.encode("cp1252").decode("utf-8")
            except Exception:
                return s
    return s

if not os.path.exists(IN_FILE):
    raise FileNotFoundError(IN_FILE)

df = pd.read_csv(IN_FILE, encoding="utf-8", dtype=str, on_bad_lines='warn')
if "ulasan" in df.columns:
    df["ulasan"] = df["ulasan"].apply(try_fix_text)
df.to_csv(OUT_FILE, index=False, encoding="utf-8-sig")
print("Wrote fixed file to", OUT_FILE)
