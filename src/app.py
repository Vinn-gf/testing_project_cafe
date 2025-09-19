from flask import Flask, jsonify, request
from flask_cors import CORS
from sentiment import analyze_reviews
import mysql.connector
from collections import OrderedDict
from copy import deepcopy
import json

app = Flask(__name__)
CORS(app)

# sentiment_analyzer = SentimentAnalyzer()

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
    db = None
    try:
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
            cursor.execute("SELECT * FROM review_tables WHERE id_kafe = %s", (id_kafe,))
        else:
            cursor.execute("SELECT * FROM review_tables")

        rows = cursor.fetchall()

        results = []
        for row in rows:
            od = OrderedDict()
            for idx, col in enumerate(columns):
                od[col] = row[idx]
            results.append(od)

        # Deduplikasi berdasarkan tuple dari semua kolom (preserve order)
        seen = set()
        unique_results = []
        for item in results:
            # buat key dari nilai-nilai kolom, gunakan None jika tidak ada
            key = tuple(item.get(col) for col in columns)
            if key not in seen:
                seen.add(key)
                unique_results.append(item)

        return unique_results

    except Exception as e:
        return {"error": str(e)}
    finally:
        try:
            cursor.close()
        except:
            pass
        try:
            if db:
                db.close()
        except:
            pass

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
    
# === tambahan admin: login_admin & get_admin_by_id ===
def login_admin(data):
    """
    data: { "username": "...", "password": "..." }
    returns: (jsonify(...), status_code)
    """
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
        # ambil admin berdasarkan username
        query = "SELECT id_admin, username, password FROM admin_tables WHERE username = %s"
        cursor.execute(query, (username,))
        result = cursor.fetchone()
        db.close()

        if result:
            id_admin_db, user_db, stored_password = result
            if str(stored_password) == str(password):
                # sukses, kembalikan info admin (tanpa password)
                return jsonify({"message": "Login successful", "admin_id": id_admin_db, "username": user_db}), 200
            else:
                return jsonify({"error": "Wrong password"}), 401
        else:
            return jsonify({"error": "Admin not found"}), 404

    except Exception as e:
        return jsonify({"error": str(e)}), 500

def get_admin_by_id(id_admin):
    """
    Mengambil data admin berdasarkan id_admin.
    Mengembalikan dict (atau None jika tidak ada).
    Struktur mengikuti pattern get_user_by_id.
    """
    try:
        db = mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="cafe_databases"
        )
        cursor = db.cursor()

        # ambil kolom tabel admin_tables (lebih aman jika struktur kolom berubah)
        cursor.execute("SHOW COLUMNS FROM admin_tables")
        columns = [col[0] for col in cursor.fetchall()]

        query = "SELECT * FROM admin_tables WHERE id_admin = %s"
        cursor.execute(query, (id_admin,))
        result = cursor.fetchone()
        db.close()

        if result:
            od = OrderedDict()
            for idx, col in enumerate(columns):
                od[col] = result[idx]
            return od
        else:
            return None
    except Exception as e:
        return {"error": str(e)}

# === akhir tambahan admin ===

def get_user_by_id(id_user):
    try:
        db = mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="cafe_databases"
        )
        cursor = db.cursor()
        query = "SELECT id_user, username, password, preferensi_jarak_minimal, preferensi_jarak_maksimal, preferensi_fasilitas, cafe_telah_dikunjungi, menu_yang_disukai FROM user_tables WHERE id_user = %s"
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
                "cafe_telah_dikunjungi": result[6],
                "menu_yang_disukai": result[7]
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

# Visited Cafes
def get_visited_cafe(id_user):
    """
    Ambil field cafe_telah_dikunjungi yang sudah berupa JSON array:
    e.g. '[{"id_cafe":25},{"id_cafe":4},{"id_cafe":17}]'
    Return: list of dicts [{ "id_cafe": …}, …]
    """
    try:
        db = mysql.connector.connect(
            host="localhost", user="root", password="", database="cafe_databases"
        )
        cursor = db.cursor()
        cursor.execute(
            "SELECT cafe_telah_dikunjungi FROM user_tables WHERE id_user = %s",
            (id_user,)
        )
        row = cursor.fetchone()
        db.close()

        if row is None:
            return None  # user tidak ditemukan

        raw = row[0] or "[]"
        try:
            visited = json.loads(raw)
            # pastikan formatnya list of dicts dengan key 'id_cafe'
            if isinstance(visited, list):
                return [v for v in visited if isinstance(v, dict) and "id_cafe" in v]
            else:
                return []
        except json.JSONDecodeError:
            return []  # JSON rusak, return empty

    except Exception as e:
        return {"error": str(e)}

def add_visited_cafe(id_user, cafe_id):
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
            SET cafe_telah_dikunjungi = JSON_ARRAY_APPEND(
                COALESCE(cafe_telah_dikunjungi, JSON_ARRAY()),
                '$',
                JSON_OBJECT('id_cafe', %s)
            )
            WHERE id_user = %s
        """
        cursor.execute(query, (cafe_id, id_user))
        db.commit()
        updated = cursor.rowcount
        db.close()

        if updated:
            return {"message": "Visited cafe berhasil ditambahkan"}, 200
        else:
            return {"error": "User tidak ditemukan"}, 404

    except Exception as e:
        return {"error": str(e)}, 500


def get_favorite_menu(id_user):
    try:
        db = mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="cafe_databases"
        )
        cursor = db.cursor()
        cursor.execute(
            "SELECT menu_yang_disukai FROM user_tables WHERE id_user = %s",
            (id_user,)
        )
        row = cursor.fetchone()
        db.close()

        if not row:
            return None

        raw = row[0] or ""
        visited = [c.strip() for c in raw.split(",") if c.strip()]
        return visited

    except Exception as e:
        return {"error": str(e)}
    
def add_favorite_menu(data):
    user_id   = data.get("user_id")
    id_cafe   = data.get("id_cafe")
    nama_menu = data.get("nama_menu")
    harga     = data.get("harga")

    if not (user_id and id_cafe and nama_menu and harga is not None):
        return {"error": "user_id, id_cafe, nama_menu, dan harga wajib diisi"}, 400

    try:
        db = mysql.connector.connect(
            host="localhost", user="root", password="", database="cafe_databases"
        )
        cursor = db.cursor()

        query = """
        UPDATE user_tables
        SET menu_yang_disukai = JSON_ARRAY_APPEND(
            COALESCE(menu_yang_disukai, JSON_ARRAY()),
            '$',
            JSON_OBJECT(
              'id_cafe',   %s,
              'nama_menu', %s,
              'harga',     %s
            )
        )
        WHERE id_user = %s
        """
        params = (id_cafe, nama_menu, harga, user_id)
        cursor.execute(query, params)
        db.commit()
        updated = cursor.rowcount
        db.close()

        if updated:
            return {"message": "Menu favorit berhasil ditambahkan"}, 200
        else:
            return {"error": "User tidak ditemukan"}, 404

    except Exception as e:
        return {"error": str(e)}, 500
    
# Feedback
def add_user_feedback(data):
    id_user = data.get("id_user")
    user_feedback = data.get("user_feedback")

    if not id_user or not user_feedback:
        return {"error": "Field id_user dan user_feedback wajib diisi"}, 400

    try:
        db = mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="cafe_databases"
        )
        cursor = db.cursor()

        query = """
            INSERT INTO feedback_tables (id_user, user_feedback)
            VALUES (%s, %s)
        """
        cursor.execute(query, (id_user, user_feedback))
        db.commit()
        db.close()

        return {"message": "Feedback berhasil disimpan"}, 201
    except Exception as e:
        return {"error": str(e)}, 500
    
# --- Feedback: ambil semua feedback dari tabel feedback_tables ---
def get_all_feedbacks():
    """
    Ambil semua baris dari feedback_tables dan kembalikan sebagai list of OrderedDict.
    Jika terjadi error, kembalikan dict {"error": "..."} agar caller dapat mengembalikan status 500.
    """
    try:
        db = mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="cafe_databases"
        )
        cursor = db.cursor()
        # ambil nama kolom (sama style seperti fungsi lain)
        cursor.execute("SHOW COLUMNS FROM feedback_tables")
        columns = [col[0] for col in cursor.fetchall()]

        cursor.execute("SELECT * FROM feedback_tables")
        rows = cursor.fetchall()
        db.close()

        results = []
        for row in rows:
            od = OrderedDict()
            for idx, col in enumerate(columns):
                od[col] = row[idx]
            results.append(od)
        return results

    except Exception as e:
        return {"error": str(e)}

# Feedback
@app.route('/api/feedback', methods=['POST'])
def api_add_feedback():
    data = request.get_json()
    result, status = add_user_feedback(data)
    return jsonify(result), status

@app.route('/api/feedbacks', methods=['GET'])
def api_get_all_feedbacks():
    feedbacks = get_all_feedbacks()
    if isinstance(feedbacks, dict) and feedbacks.get("error"):
        return jsonify(feedbacks), 500
    return jsonify(feedbacks), 200

# Menu
@app.route('/api/favorite_menu/<int:id_user>', methods=['GET'])
def api_get_favorite_menu(id_user):
    result = get_favorite_menu(id_user)
    if result is None:
        return jsonify({"error": "User not found"}), 404
    if isinstance(result, dict) and result.get("error"):
        return jsonify(result), 500
    return jsonify({"favorite menu": result}), 200

@app.route('/api/user/favorite_menu', methods=['POST'])
def api_add_favorite_menu():
    data = request.get_json()
    result, status = add_favorite_menu(data)
    return jsonify(result), status

# Visited Cafes
@app.route('/api/visited/<int:id_user>', methods=['GET'])
def api_get_visited_cafe(id_user):
    result = get_visited_cafe(id_user)
    if result is None:
        return jsonify({"error": "User tidak ditemukan"}), 404
    if isinstance(result, dict) and result.get("error"):
        return jsonify(result), 500
    return jsonify(result), 200

@app.route('/api/visited/<int:id_user>', methods=['POST'])
def api_add_visited_cafe(id_user):
    # 1. Ambil JSON body
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body harus berformat JSON"}), 400

    # 2. Pastikan field "id_cafe" ada
    cafe_id = data.get("id_cafe")
    if cafe_id is None:
        return jsonify({"error": "Field id_cafe wajib diisi"}), 400

    # 3. Panggil helper untuk menambah cafe ke array JSON
    payload, status_code = add_visited_cafe(id_user, cafe_id)

    # 4. Wrap hasil helper dengan jsonify dan kembalikan status code-nya
    return jsonify(payload), status_code

@app.route('/api/user/preferences', methods=['POST'])
def api_update_user_preferences():
    data = request.get_json()
    result, status = update_user_preferences(data)
    return jsonify(result), status

# Users
def get_all_users():
    """Ambil semua user dari tabel user_tables."""
    try:
        db = mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="cafe_databases"
        )
        cursor = db.cursor()
        # Ambil semua kolom, atau pilih kolom yang Anda butuhkan
        cursor.execute("SHOW COLUMNS FROM user_tables")
        columns = [col[0] for col in cursor.fetchall()]

        cursor.execute("SELECT * FROM user_tables")
        rows = cursor.fetchall()
        db.close()

        results = []
        for row in rows:
            od = OrderedDict()
            for idx, col in enumerate(columns):
                od[col] = row[idx]
            results.append(od)
        return results
    except Exception as e:
        return {"error": str(e)}

@app.route('/api/users', methods=['GET'])
def api_get_all_users():
    users = get_all_users()
    if isinstance(users, dict) and users.get("error"):
        return jsonify(users), 500
    return jsonify(users), 200    

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

# Admin endpoints (routes)
@app.route('/api/login_admin', methods=['POST'])
def api_login_admin():
    data = request.get_json()
    return login_admin(data)

@app.route('/api/admin/<int:id_admin>', methods=['GET'])
def api_get_admin(id_admin):
    admin = get_admin_by_id(id_admin)
    if isinstance(admin, dict) and admin.get("error"):
        return jsonify(admin), 500
    if admin:
        return jsonify(admin), 200
    else:
        return jsonify({"error": "Admin not found"}), 404

@app.route('/api/sentiment/<int:id_kafe>', methods=['GET'])
def api_sentiment(id_kafe):
    reviews = get_reviews(id_kafe)
    if not isinstance(reviews, list):
        return jsonify({"error": "Failed to fetch reviews"}), 500
    reviews_copy = deepcopy(reviews)
    analyzed = analyze_reviews(reviews_copy, id_kafe)
    if analyzed is None:
        return jsonify({"error": "Sentiment analysis returned nothing"}), 500

    return jsonify(analyzed), 200

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
