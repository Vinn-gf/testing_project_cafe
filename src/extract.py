# extract_seed.py (recommended)
import os
import pandas as pd
from sqlalchemy import create_engine

OUT_DIR = "data"
OUT_FILE = os.path.join(OUT_DIR, "label_seed_2.csv")
SEED_SIZE = 400

# ganti user:password@host/dbname sesuai Anda
user = "root"
password = ""
host = "localhost"
db = "cafe_databases"

# gunakan utf8mb4 agar emoji tersupport
engine_str = f"mysql+mysqlconnector://{user}:{password}@{host}/{db}?charset=utf8mb4"
engine = create_engine(engine_str, pool_recycle=3600)

os.makedirs(OUT_DIR, exist_ok=True)

q = f"""
SELECT ulasan
FROM review_tables
WHERE ulasan IS NOT NULL
ORDER BY RAND()
LIMIT {SEED_SIZE}
"""

df = pd.read_sql(q, con=engine)   # pandas + SQLAlchemy => lebih handal
# simpan CSV dengan utf-8 BOM supaya Excel juga terbaca baik
df.to_csv(OUT_FILE, index=False, encoding="utf-8-sig")
print(f"Saved {len(df)} rows to {OUT_FILE}")
