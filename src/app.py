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

def get_data_by_id(nomor):
    db = mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="cafe_databases"
    )
    cursor = db.cursor()

    cursor.execute("SHOW COLUMNS FROM cafe_tables")
    columns = [col[0] for col in cursor.fetchall()]

    query = "SELECT * FROM cafe_tables WHERE nomor = %s"
    cursor.execute(query, (nomor,))
    data = cursor.fetchone()
    db.close()

    if data:
        od = OrderedDict()
        for idx, col in enumerate(columns):
            od[col] = data[idx]
        return od
    else:
        return None

def get_reviews(id_kafe=None):
    db = mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="cafe_databases"
    )
    cursor = db.cursor()

    cursor.execute("SHOW COLUMNS FROM review_tables")
    columns = [col[0] for col in cursor.fetchall()]

    if id_kafe:
        query = "SELECT * FROM review_tables WHERE id_kafe = %s"
        cursor.execute(query, (id_kafe,))
    else:
        cursor.execute("SELECT * FROM review_tables")

    data = cursor.fetchall()
    db.close()

    results = []
    for row in data:
        od = OrderedDict()
        for idx, col in enumerate(columns):
            od[col] = row[idx]
        results.append(od)
    return results

@app.route('/api/reviews/<int:id_kafe>', methods=['GET'])
def api_reviews(id_kafe):
    return jsonify(get_reviews(id_kafe))


@app.route('/api/data', methods=['GET'])
def api_data():
    return jsonify(get_data())

@app.route('/api/search/<keyword>', methods=['GET'])
def api_search(keyword):
    return jsonify(get_data(keyword))

@app.route('/api/cafe/<int:nomor>', methods=['GET'])
def api_cafe(nomor):
    cafe = get_data_by_id(nomor)
    if cafe:
        return jsonify(cafe)
    else:
        return jsonify({"error": "Cafe not found"}), 404

if __name__ == '__main__':
    app.run(debug=True)
