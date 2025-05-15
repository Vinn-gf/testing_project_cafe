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
        query = "SELECT * FROM cafe_tables WHERE nama_kafe LIKE %s OR nama_kafe LIKE %s"
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

def get_menu(search_term=None):
    db = mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="cafe_databases"
    )
    cursor = db.cursor()

    cursor.execute("SHOW COLUMNS FROM menu_tables")
    columns = [col[0] for col in cursor.fetchall()]

    if search_term:
        query = "SELECT * FROM menu_tables WHERE nama_menu LIKE %s OR nama_menu LIKE %s"
        cursor.execute(query, ('%' + search_term + '%', '%' + search_term + '%'))
    else:
        cursor.execute("SELECT * FROM menu_tables")

    data = cursor.fetchall()
    db.close()
    
    results = []
    for row in data:
        od = OrderedDict()
        for idx, col in enumerate(columns):
            od[col] = row[idx]
        results.append(od)
    return results

def get_menu_by_id(id_cafe):
    db = mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="cafe_databases"
    )
    cursor = db.cursor()

    # Ambil nama kolom
    cursor.execute("SHOW COLUMNS FROM menu_tables")
    columns = [col[0] for col in cursor.fetchall()]

    # Ambil semua baris untuk id_cafe
    query = "SELECT * FROM menu_tables WHERE id_cafe = %s"
    cursor.execute(query, (id_cafe,))
    rows = cursor.fetchall()
    db.close()

    # Jika tidak ada baris, kembalikan None
    if not rows:
        return None

    # Ubah setiap baris menjadi OrderedDict dan kumpulkan
    menus = []
    for row in rows:
        od = OrderedDict()
        for idx, col in enumerate(columns):
            od[col] = row[idx]
        menus.append(od)

    return menus

def get_user_rating(search_term=None):
    db = mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="cafe_databases"
    )
    cursor = db.cursor()

    cursor.execute("SHOW COLUMNS FROM user_rating_table")
    columns = [col[0] for col in cursor.fetchall()]

    if search_term:
        query = "SELECT * FROM user_rating_table WHERE id_user LIKE %s OR id_user LIKE %s"
        cursor.execute(query, ('%' + search_term + '%', '%' + search_term + '%'))
    else:
        cursor.execute("SELECT * FROM user_rating_table")

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

def register_user(data):
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    try:
        db = mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="cafe_databases"
        )
        cursor = db.cursor()

        cursor.execute("SELECT * FROM user_tables WHERE username = %s", (username,))
        if cursor.fetchone():
            db.close()
            return jsonify({"error": "Username already exists"}), 400

        query = "INSERT INTO user_tables (username, password) VALUES (%s, %s)"
        cursor.execute(query, (username, password))
        db.commit()
        user_id = cursor.lastrowid
        db.close()

        return jsonify({"message": "User registered successfully", "user_id": user_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
def login_user(data):
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    try:
        db = mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="cafe_databases"
        )
        cursor = db.cursor()
        query = "SELECT id_user, username, password, preferensi_jarak_minimal, preferensi_jarak_maksimal, preferensi_fasilitas FROM user_tables WHERE username = %s"
        cursor.execute(query, (username,))
        result = cursor.fetchone()
        db.close()

        if result:
            user_id, user, stored_password, preferensi_jarak_minimal_user, preferensi_jarak_maksimal_user, preferensi_fasilitas_user, = result
            if stored_password == password:
                return jsonify({"message": "Login successful", "user_id": user_id, "minimum_distance_preference": preferensi_jarak_minimal_user, "maximum_distance_preference": preferensi_jarak_maksimal_user, "facilities_preference": preferensi_fasilitas_user}), 200
            else:
                return jsonify({"error": "Wrong password"}), 401
        else:
            return jsonify({"error": "User not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
def get_user_by_id(id_user):
    try:
        db = mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="cafe_databases"
        )
        cursor = db.cursor()
        query = "SELECT id_user, username, password, preferensi_jarak_minimal, preferensi_jarak_maksimal, preferensi_fasilitas, cafe_telah_dikunjungi FROM user_tables WHERE id_user = %s"
        cursor.execute(query, (id_user,))
        result = cursor.fetchone()
        db.close()
        if result:
            return {
                "id_user": result[0],
                "username": result[1],
                "password": result[2],
                "preferensi_jarak_minimal": result[3],
                "preferensi_jarak_maksimal": result[4],
                "preferensi_fasilitas": result[5],
                "cafe_telah_dikunjungi": result[6]
            }
        else:
            return None
    except Exception as e:
        return {"error": str(e)}

def update_user_preferences(data):
    user_id = data.get("user_id")
    preferensi_jarak_minimal = data.get("preferensi_jarak_minimal")
    preferensi_jarak_maksimal = data.get("preferensi_jarak_maksimal")
    preferensi_fasilitas = data.get("preferensi_fasilitas")

    if not user_id:
        return {"error": "User id is required"}, 400

    try:
        db = mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="cafe_databases"
        )
        cursor = db.cursor()
        query = """UPDATE user_tables 
                   SET preferensi_jarak_minimal = %s, preferensi_jarak_maksimal = %s, preferensi_fasilitas = %s 
                   WHERE id_user = %s"""
        cursor.execute(query, (preferensi_jarak_minimal, preferensi_jarak_maksimal, preferensi_fasilitas, user_id))
        db.commit()
        db.close()
        
        if cursor.rowcount > 0:
            return {"message": "User preferences updated successfully"}, 200
        else:
            return {"error": "User not found or no changes made"}, 404

    except Exception as e:
        return {"error": str(e)}, 500
    
def add_visited_cafe(data):
    user_id = data.get("user_id")
    cafe_name = data.get("cafe_name")
    
    if not user_id or not cafe_name:
        return {"error": "User ID and Cafe Name are required"}, 400

    try:
        db = mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="cafe_databases"
        )
        cursor = db.cursor()
        query = """
            UPDATE user_tables 
            SET cafe_telah_dikunjungi = CASE 
                WHEN TRIM(cafe_telah_dikunjungi) = '' THEN %s
                ELSE CONCAT(cafe_telah_dikunjungi, ', ', %s)
            END
            WHERE id_user = %s
        """
        cursor.execute(query, (cafe_name, cafe_name, user_id))
        db.commit()
        db.close()
        
        if cursor.rowcount > 0:
            return {"message": "Visited cafe added successfully"}, 200
        else:
            return {"error": "User not found or no changes made"}, 404

    except Exception as e:
        return {"error": str(e)}, 500


@app.route('/api/user/visited', methods=['POST'])
def api_add_visited_cafe():
    data = request.get_json()
    result, status = add_visited_cafe(data)
    return jsonify(result), status


@app.route('/api/user/preferences', methods=['POST'])
def api_update_user_preferences():
    data = request.get_json()
    result, status = update_user_preferences(data)
    return jsonify(result), status

    
@app.route('/api/users/<int:id_user>', methods=['GET'])
def api_user_by_id(id_user):
    user = get_user_by_id(id_user)
    if user:
        return jsonify(user)
    else:
        return jsonify({"error": "User not found"}), 404
    
@app.route('/api/reviews/<int:id_kafe>', methods=['GET'])
def api_reviews(id_kafe):
    return jsonify(get_reviews(id_kafe))


@app.route('/api/data', methods=['GET'])
def api_data():
    return jsonify(get_data())

@app.route('/api/menus', methods=['GET'])
def api_menu():
    return jsonify(get_menu())

@app.route('/api/menu/<int:id_cafe>', methods=['GET'])
def api_menu_by_id(id_cafe):
    menus = get_menu_by_id(id_cafe)
    if menus is None:
        return jsonify({"error": "Menu not found"}), 404
    return jsonify(menus), 200

@app.route('/api/user_rating', methods=['GET'])
def api_user_rating():
    return jsonify(get_user_rating())

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
    
@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json()
    return register_user(data)

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    return login_user(data)

if __name__ == "__main__":
    app.run(port=8080, debug=True)
