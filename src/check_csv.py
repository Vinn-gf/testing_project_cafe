
# fix annotated
# scripts/fix_annotated_csv.py
"""
Robust reader for annotator CSV `data/to_label_round_labeled.csv`.
Try multiple encodings/separators, fall back to csv.reader to handle quoted multiline.
Output -> overwrite data/to_label_round_labeled.fixed.csv (safe) and print summary.
"""
# import csv, sys, re
# from pathlib import Path
# import pandas as pd

# SRC = Path("data/to_label_round_labeled.csv")
# OUT = Path("data/to_label_round_labeled.fixed.csv")

# if not SRC.exists():
#     print("ERROR: source not found:", SRC)
#     sys.exit(1)

# def try_pandas_read(enc, sep):
#     try:
#         if sep is None:
#             df = pd.read_csv(SRC, encoding=enc, engine="python", dtype=str, on_bad_lines="warn")
#         else:
#             df = pd.read_csv(SRC, encoding=enc, sep=sep, engine="python", dtype=str, on_bad_lines="warn")
#         return df
#     except Exception as e:
#         return e

# encodings = ["utf-8-sig","utf-8","cp1252","latin-1"]
# seps = [None, ",", ";", "\t", "|"]

# # try quick pandas attempts first
# candidates = []
# for enc in encodings:
#     for sep in seps:
#         res = try_pandas_read(enc, sep)
#         if isinstance(res, pd.DataFrame):
#             # score: prefer presence of common columns
#             cols = [c.strip().lower() for c in res.columns.tolist()]
#             score = len(res.columns)
#             if "label" in cols: score += 10
#             if "ulasan" in cols or "review" in cols or "comment" in cols: score += 5
#             candidates.append((score, enc, sep, res))
# if candidates:
#     best = sorted(candidates, key=lambda x: -x[0])[0]
#     score,enc,sep,df = best
#     print(f"[OK] pandas read succeeded with encoding={enc!r}, sep={sep!r}. Columns: {df.columns.tolist()} Rows: {len(df)}")
#     df.to_csv(OUT, index=False, encoding="utf-8-sig")
#     print(f"[SAVED] clean copy -> {OUT}")
#     sys.exit(0)

# # fallback: use csv.reader trying multiple delimiters; this handles quoted multiline
# sample = SRC.read_text(encoding="utf-8", errors="replace")[:8192]
# # heuristic choose candidate delimiters
# delims = [",",";","\t","|"]
# detected = max(delims, key=lambda d: sample.count(d))

# best_rows = None
# best_delim = None
# best_score = -1

# for d in delims:
#     try:
#         with open(SRC, "r", encoding="utf-8", errors="replace", newline="") as f:
#             reader = csv.reader(f, delimiter=d, quotechar='"')
#             rows = list(reader)
#         # compute score: prefer rows where header contains 'label' or 'ulasan'
#         header = rows[0] if rows else []
#         hdrtext = " ".join(header).lower()
#         score = 0
#         if "label" in hdrtext: score += 10
#         if "ulasan" in hdrtext or "review" in hdrtext or "comment" in hdrtext: score += 5
#         # prefer delimiters which produce consistent row lengths
#         lens = [len(r) for r in rows if r is not None]
#         if len(lens) > 0:
#             median_len = sorted(lens)[len(lens)//2]
#             score += -abs(median_len - 2)  # prefer around 2 columns
#         # also prefer many rows
#         score += min(10, len(rows)//50)
#         if score > best_score:
#             best_score = score
#             best_rows = rows
#             best_delim = d
#     except Exception as e:
#         continue

# if best_rows is None:
#     print("Failed to parse file with csv.reader fallback. Show first 2000 bytes:")
#     print(SRC.read_text(encoding="utf-8", errors="replace")[:2000])
#     sys.exit(1)

# print(f"[INFO] csv.reader used delimiter {best_delim!r}. Parsed rows: {len(best_rows)}. Example row lengths (first 10): {[len(r) for r in best_rows[:10]]}")

# # If header row looks combined like 'ulasan;label', split it
# first = best_rows[0]
# if len(first) == 1 and ";" in first[0] and ("ulasan" in first[0].lower() or "label" in first[0].lower()):
#     # split header and rebuild rows by splitting each raw line by ';' (dangerous but works if semicolon is true sep)
#     lines = SRC.read_text(encoding="utf-8", errors="replace").splitlines()
#     new_rows = [line.split(";") for line in lines if line.strip()!=""]
#     best_rows = new_rows
#     print("[INFO] Header was combined; re-split by ';'.")

# # Now we will attempt to normalize rows into DataFrame with columns:
# # common patterns: [pool_idx, ulasan, label]  OR [ulasan, label] OR [label only?]
# # Heuristic:
# rows = best_rows
# # drop empty rows
# rows = [r for r in rows if any(cell.strip() for cell in r)]
# # Determine header
# header = rows[0]
# has_header = False
# header_lower = [c.strip().lower() for c in header]
# if any(x in header_lower for x in ["label","ulasan","pool_idx","review","comment"]):
#     has_header = True
#     data_rows = rows[1:]
# else:
#     data_rows = rows

# # Build normalized list of dicts with attempt to find ulasan and label
# normalized = []
# for r in data_rows:
#     # strip all cell strings
#     r = [ (c if c is not None else "").strip() for c in r ]
#     if len(r) == 1:
#         # single column: could be "ulasan" only or "ulasan;label" not split
#         cell = r[0]
#         if ";" in cell and (";positive" in cell.lower() or ";negative" in cell.lower() or ";neutral" in cell.lower()):
#             parts = cell.rsplit(";", 1)
#             ulasan = parts[0].strip()
#             label = parts[1].strip()
#         elif "," in cell and (",positive" in cell.lower() or ",negative" in cell.lower() or ",neutral" in cell.lower()):
#             parts = cell.rsplit(",", 1)
#             ulasan = parts[0].strip()
#             label = parts[1].strip()
#         else:
#             # assume only ulasan present; label missing
#             ulasan = cell
#             label = ""
#         normalized.append({"ulasan": ulasan, "label": label})
#     elif len(r) == 2:
#         # assume [ulasan, label] or [pool_idx, ulasan] ambiguous -> try to detect label value
#         maybe_label = r[1].lower()
#         if maybe_label in ("positive","negative","neutral"):
#             normalized.append({"ulasan": r[0], "label": r[1]})
#         else:
#             # assume [pool_idx, ulasan] -> label missing
#             normalized.append({"ulasan": r[1], "label": "" , "pool_idx": r[0]})
#     else:
#         # len >=3 -> try detect which column is label (last column often)
#         # find any column matching label values
#         label_idx = None
#         for i,cell in enumerate(r):
#             if cell.lower() in ("positive","negative","neutral"):
#                 label_idx = i
#                 break
#         if label_idx is None:
#             # assume last is label
#             label_idx = len(r)-1
#         # assume the ulasan is the concatenation of middle columns excluding label and pool_idx at start if numeric
#         pool_idx = None
#         if r[0].isdigit():
#             pool_idx = r[0]
#             ulasan_parts = r[1:label_idx]
#         else:
#             ulasan_parts = r[:label_idx]
#         ulasan = " ".join([p for p in ulasan_parts if p])
#         label = r[label_idx] if label_idx < len(r) else ""
#         out = {"ulasan": ulasan.strip(), "label": label.strip()}
#         if pool_idx is not None:
#             out["pool_idx"] = pool_idx
#         normalized.append(out)

# # Convert to DataFrame
# df = pd.DataFrame(normalized)
# # ensure columns exist
# if 'label' not in df.columns:
#     df['label'] = ""

# # basic cleaning: collapse multi-spaces, replace newlines inside text
# def clean(s):
#     if s is None: return ""
#     t = str(s).replace("\r"," ").replace("\n"," ")
#     t = re.sub(r"\s+"," ", t).strip()
#     return t
# df['ulasan'] = df['ulasan'].astype(str).apply(clean)
# df['label'] = df['label'].astype(str).str.lower().str.strip()

# # Save
# df.to_csv(OUT, index=False, encoding="utf-8-sig")
# print(f"[SAVED] Normalized file saved -> {OUT}  (rows: {len(df)})")
# print("Columns:", df.columns.tolist())
# print(df.head(10).to_string(index=False))


# check csv file
# import pandas as pd, sys
# p="data/to_label_round_labeled.csv"
# try:
#     df=pd.read_csv(p, encoding="utf-8-sig", engine="python", dtype=str).fillna("")
#     print("columns:", df.columns.tolist())
#     print("rows:", len(df))
#     if 'label' in df.columns:
#         print("label values:", sorted(df['label'].str.lower().unique()))
#     else:
#         print("ERROR: no 'label' column")
# except Exception as e:
#     print("Read error:", e)
#     sys.exit(1)

# labeled_all_comma.csv
import pandas as pd
df = pd.read_csv("data/labeled_all.csv", sep=";", engine="python", encoding="utf-8-sig")
df.to_csv("data/labeled_all_comma.csv", index=False, encoding="utf-8-sig")
