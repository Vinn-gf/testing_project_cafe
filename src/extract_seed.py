# extract_seed.py
import pandas as pd
import mysql.connector

db = mysql.connector.connect(host="localhost", user="root", password="", database="cafe_databases")
q = "SELECT ulasan FROM review_tables WHERE ulasan IS NOT NULL ORDER BY RAND() LIMIT 400"
df = pd.read_sql(q, con=db)
df.to_csv("data/label_seed.csv", index=False, encoding="utf-8")
print("Saved data/label_seed.csv (400 rows) untuk dilabel manual.")
