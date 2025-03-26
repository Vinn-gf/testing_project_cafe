from flask import Flask, jsonify
from flask_cors import CORS
import mysql.connector
from collections import OrderedDict

app = Flask(__name__)
CORS(app)  # Mengizinkan akses dari origin lain (misalnya React di localhost:3000)

def get_data():
    # Membuat koneksi ke database MySQL (XAMPP)
    db = mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="cafe_databases"
    )
    cursor = db.cursor()
    
    # Ambil nama kolom sesuai urutan asli di tabel
    cursor.execute("SHOW COLUMNS FROM cafe_tables")
    columns = [col[0] for col in cursor.fetchall()]
    
    # Ambil seluruh data dari tabel
    cursor.execute("SELECT * FROM cafe_tables")
    data = cursor.fetchall()
    db.close()

    # Gabungkan data dalam OrderedDict agar urutannya sama seperti di database
    results = []
    for row in data:
        od = OrderedDict()
        for idx, col in enumerate(columns):
            od[col] = row[idx]
        results.append(od)
    return results

@app.route('/api/data', methods=['GET'])
def api_data():
    return jsonify(get_data())

if __name__ == '__main__':
    app.run(debug=True)
