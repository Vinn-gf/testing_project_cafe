from flask import Flask, jsonify, request
from flask_cors import CORS
import mysql.connector
from collections import OrderedDict

app = Flask(__name__)
CORS(app)

def get_data(search_term=None):
    db = mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="cafe_databases"
    )
    cursor = db.cursor()

    cursor.execute("SHOW COLUMNS FROM cafe_tables")
    columns = [col[0] for col in cursor.fetchall()]

    if search_term:
        query = "SELECT * FROM cafe_tables WHERE nama_kafe LIKE %s OR alamat LIKE %s"
        cursor.execute(query, ('%' + search_term + '%', '%' + search_term + '%'))
    else:
        cursor.execute("SELECT * FROM cafe_tables")

    data = cursor.fetchall()
    db.close()

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

@app.route('/api/search/<keyword>', methods=['GET'])
def api_search(keyword):
    return jsonify(get_data(keyword))

if __name__ == '__main__':
    app.run(debug=True)
