# app.py
from flask import Flask, jsonify, request, send_from_directory, abort
from flask_cors import CORS
from sentiment import analyze_reviews
import mysql.connector
from collections import OrderedDict
from copy import deepcopy
import json
import os
from werkzeug.utils import secure_filename
import uuid

app = Flask(__name__)
CORS(app)

# ---------------- Upload configuration ----------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads", "cafes")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
MAX_CONTENT_LENGTH = 8 * 1024 * 1024  # 8 MB
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

def allowed_file(filename):
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in ALLOWED_EXTENSIONS

# ---------------- Database helpers (use your DB config) ----------------
DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "cafe_databases"
}

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

# ---------------- Existing functions (kept/merged) ----------------

def get_data(search_term=None):
    db = get_db_connection()
    cursor = db.cursor()
    cursor.execute("SHOW COLUMNS FROM cafe_tables")
    columns = [col[0] for col in cursor.fetchall()]

    if search_term:
        query = "SELECT * FROM cafe_tables WHERE nama_kafe LIKE %s OR nama_kafe LIKE %s"
        cursor.execute(query, ('%' + search_term + '%', '%' + search_term + '%'))
    else:
        cursor.execute("SELECT * FROM cafe_tables")

    data = cursor.fetchall()
    cursor.close()
    db.close()
    
    results = []
    for row in data:
        od = OrderedDict()
        for idx, col in enumerate(columns):
            od[col] = row[idx]
        results.append(od)
    return results

def get_menu(search_term=None):
    db = get_db_connection()
    cursor = db.cursor()

    cursor.execute("SHOW COLUMNS FROM menu_tables")
    columns = [col[0] for col in cursor.fetchall()]

    if search_term:
        query = "SELECT * FROM menu_tables WHERE nama_menu LIKE %s OR nama_menu LIKE %s"
        cursor.execute(query, ('%' + search_term + '%', '%' + search_term + '%'))
    else:
        cursor.execute("SELECT * FROM menu_tables")

    data = cursor.fetchall()
    cursor.close()
    db.close()
    
    results = []
    for row in data:
        od = OrderedDict()
        for idx, col in enumerate(columns):
            od[col] = row[idx]
        results.append(od)
    return results

def get_menu_by_id(id_cafe):
    db = get_db_connection()
    cursor = db.cursor()

    cursor.execute("SHOW COLUMNS FROM menu_tables")
    columns = [col[0] for col in cursor.fetchall()]

    query = "SELECT * FROM menu_tables WHERE id_cafe = %s"
    cursor.execute(query, (id_cafe,))
    rows = cursor.fetchall()
    cursor.close()
    db.close()

    if not rows:
        return []

    menus = []
    for row in rows:
        od = OrderedDict()
        for idx, col in enumerate(columns):
            od[col] = row[idx]
        menus.append(od)

    return menus

def get_data_by_id(nomor):
    db = get_db_connection()
    cursor = db.cursor()

    cursor.execute("SHOW COLUMNS FROM cafe_tables")
    columns = [col[0] for col in cursor.fetchall()]

    query = "SELECT * FROM cafe_tables WHERE nomor = %s"
    cursor.execute(query, (nomor,))
    data = cursor.fetchone()
    cursor.close()
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
    cursor = None
    try:
        db = get_db_connection()
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

        # deduplicate preserving order
        seen = set()
        unique_results = []
        for item in results:
            key = tuple(item.get(col) for col in columns)
            if key not in seen:
                seen.add(key)
                unique_results.append(item)

        return unique_results

    except Exception as e:
        return {"error": str(e)}
    finally:
        try:
            if cursor:
                cursor.close()
        except:
            pass
        try:
            if db:
                db.close()
        except:
            pass

# ---------------- User / auth functions ----------------

def register_user_helper(data):
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return {"error": "Username and password are required"}, 400
    try:
        db = get_db_connection()
        cursor = db.cursor()

        cursor.execute("SELECT * FROM user_tables WHERE username = %s", (username,))
        if cursor.fetchone():
            cursor.close()
            db.close()
            return {"error": "Username already exists"}, 400

        query = "INSERT INTO user_tables (username, password) VALUES (%s, %s)"
        cursor.execute(query, (username, password))
        db.commit()
        user_id = cursor.lastrowid
        cursor.close()
        db.close()

        return {"message": "User registered successfully", "user_id": user_id}, 201
    except Exception as e:
        return {"error": str(e)}, 500

def login_user_helper(data):
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return {"error": "Username and password are required"}, 400

    try:
        db = get_db_connection()
        cursor = db.cursor()
        query = "SELECT id_user, username, password, preferensi_jarak_minimal, preferensi_jarak_maksimal, preferensi_fasilitas FROM user_tables WHERE username = %s"
        cursor.execute(query, (username,))
        result = cursor.fetchone()
        cursor.close()
        db.close()

        if result:
            user_id, user, stored_password, preferensi_jarak_minimal_user, preferensi_jarak_maksimal_user, preferensi_fasilitas_user = result
            if stored_password == password:
                return {
                    "message": "Login successful",
                    "user_id": user_id,
                    "minimum_distance_preference": preferensi_jarak_minimal_user,
                    "maximum_distance_preference": preferensi_jarak_maksimal_user,
                    "facilities_preference": preferensi_fasilitas_user
                }, 200
            else:
                return {"error": "Wrong password"}, 401
        else:
            return {"error": "User not found"}, 404
    except Exception as e:
        return {"error": str(e)}, 500

# --- Admin functions ---

def login_admin_helper(data):
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return {"error": "Username and password are required"}, 400

    try:
        db = get_db_connection()
        cursor = db.cursor()
        query = "SELECT id_admin, username, password FROM admin_tables WHERE username = %s"
        cursor.execute(query, (username,))
        result = cursor.fetchone()
        cursor.close()
        db.close()

        if result:
            id_admin_db, user_db, stored_password = result
            if str(stored_password) == str(password):
                return {"message": "Login successful", "admin_id": id_admin_db, "username": user_db}, 200
            else:
                return {"error": "Wrong password"}, 401
        else:
            return {"error": "Admin not found"}, 404
    except Exception as e:
        return {"error": str(e)}, 500

def get_admin_by_id(id_admin):
    try:
        db = get_db_connection()
        cursor = db.cursor()
        cursor.execute("SHOW COLUMNS FROM admin_tables")
        columns = [col[0] for col in cursor.fetchall()]

        query = "SELECT * FROM admin_tables WHERE id_admin = %s"
        cursor.execute(query, (id_admin,))
        result = cursor.fetchone()
        cursor.close()
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

# ---------------- User retrieval + update preferences ----------------

def get_user_by_id(id_user):
    """
    Returns user record and attempts to parse cafe_telah_dikunjungi and menu_yang_disukai
    so frontend receives arrays/objects when possible.
    """
    try:
        db = get_db_connection()
        cursor = db.cursor()
        query = "SELECT id_user, username, password, preferensi_jarak_minimal, preferensi_jarak_maksimal, preferensi_fasilitas, cafe_telah_dikunjungi, menu_yang_disukai FROM user_tables WHERE id_user = %s"
        cursor.execute(query, (id_user,))
        result = cursor.fetchone()
        cursor.close()
        db.close()
        if result:
            raw_visited = result[6]
            raw_fav = result[7]

            # Try parse JSON fields
            visited_parsed = []
            if raw_visited is None:
                visited_parsed = []
            else:
                if isinstance(raw_visited, (list, dict)):
                    visited_parsed = raw_visited if isinstance(raw_visited, list) else [raw_visited]
                else:
                    try:
                        visited_parsed = json.loads(raw_visited)
                        if isinstance(visited_parsed, dict):
                            visited_parsed = [visited_parsed]
                        elif not isinstance(visited_parsed, list):
                            visited_parsed = []
                    except Exception:
                        # fallback: empty or raw string
                        visited_parsed = []

            fav_parsed = []
            if raw_fav is None:
                fav_parsed = []
            else:
                if isinstance(raw_fav, (list, dict)):
                    fav_parsed = raw_fav if isinstance(raw_fav, list) else [raw_fav]
                else:
                    try:
                        fav_parsed = json.loads(raw_fav)
                        if isinstance(fav_parsed, dict):
                            fav_parsed = [fav_parsed]
                        elif not isinstance(fav_parsed, list):
                            fav_parsed = []
                    except Exception:
                        fav_parsed = []

            return {
                "id_user": result[0],
                "username": result[1],
                "password": result[2],
                "preferensi_jarak_minimal": result[3],
                "preferensi_jarak_maksimal": result[4],
                "preferensi_fasilitas": result[5],
                "cafe_telah_dikunjungi": visited_parsed,
                "menu_yang_disukai": fav_parsed
            }
        else:
            return None
    except Exception as e:
        return {"error": str(e)}

def update_user_preferences_helper(data):
    user_id = data.get("user_id")
    preferensi_jarak_minimal = data.get("preferensi_jarak_minimal")
    preferensi_jarak_maksimal = data.get("preferensi_jarak_maksimal")
    preferensi_fasilitas = data.get("preferensi_fasilitas")

    if not user_id:
        return {"error": "User id is required"}, 400

    try:
        db = get_db_connection()
        cursor = db.cursor()
        query = """UPDATE user_tables 
                   SET preferensi_jarak_minimal = %s, preferensi_jarak_maksimal = %s, preferensi_fasilitas = %s 
                   WHERE id_user = %s"""
        cursor.execute(query, (preferensi_jarak_minimal, preferensi_jarak_maksimal, preferensi_fasilitas, user_id))
        db.commit()
        updated = cursor.rowcount
        cursor.close()
        db.close()
        
        if updated:
            return {"message": "User preferences updated successfully"}, 200
        else:
            return {"error": "User not found or no changes made"}, 404

    except Exception as e:
        return {"error": str(e)}, 500

# ---------------- Visited cafes + favorites + feedback ----------------

def get_visited_cafe(id_user):
    try:
        db = get_db_connection()
        cursor = db.cursor()
        cursor.execute("SELECT cafe_telah_dikunjungi FROM user_tables WHERE id_user = %s", (id_user,))
        row = cursor.fetchone()
        cursor.close()
        db.close()

        if row is None:
            return []

        raw = row[0] or "[]"
        try:
            visited = json.loads(raw)
            if isinstance(visited, list):
                return [v for v in visited if isinstance(v, dict) and "id_cafe" in v]
            else:
                return []
        except Exception:
            return []
    except Exception as e:
        return {"error": str(e)}

def add_visited_cafe_helper(id_user, cafe_id):
    try:
        db = get_db_connection()
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
        cursor.close()
        db.close()

        if updated:
            return {"message": "Visited cafe berhasil ditambahkan"}, 200
        else:
            return {"error": "User tidak ditemukan"}, 404

    except Exception as e:
        return {"error": str(e)}, 500

def get_favorite_menu(id_user):
    try:
        db = get_db_connection()
        cursor = db.cursor()
        cursor.execute("SELECT menu_yang_disukai FROM user_tables WHERE id_user = %s", (id_user,))
        row = cursor.fetchone()
        cursor.close()
        db.close()

        if not row:
            return []

        raw = row[0] or "[]"
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return parsed
            else:
                return [parsed]
        except Exception:
            return []
    except Exception as e:
        return {"error": str(e)}
    
def add_favorite_menu_helper(data):
    user_id   = data.get("user_id")
    id_cafe   = data.get("id_cafe")
    nama_menu = data.get("nama_menu")
    harga     = data.get("harga")

    if not (user_id and id_cafe and nama_menu and harga is not None):
        return {"error": "user_id, id_cafe, nama_menu, dan harga wajib diisi"}, 400

    try:
        db = get_db_connection()
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
        cursor.close()
        db.close()

        if updated:
            return {"message": "Menu favorit berhasil ditambahkan"}, 200
        else:
            return {"error": "User tidak ditemukan"}, 404

    except Exception as e:
        return {"error": str(e)}, 500

def add_user_feedback_helper(data):
    id_user = data.get("id_user")
    user_feedback = data.get("user_feedback")

    if not id_user or not user_feedback:
        return {"error": "Field id_user dan user_feedback wajib diisi"}, 400

    try:
        db = get_db_connection()
        cursor = db.cursor()

        query = "INSERT INTO feedback_tables (id_user, user_feedback) VALUES (%s, %s)"
        cursor.execute(query, (id_user, user_feedback))
        db.commit()
        cursor.close()
        db.close()
        return {"message": "Feedback berhasil disimpan"}, 201
    except Exception as e:
        return {"error": str(e)}, 500
    
def get_all_feedbacks():
    try:
        db = get_db_connection()
        cursor = db.cursor()
        cursor.execute("SHOW COLUMNS FROM feedback_tables")
        columns = [col[0] for col in cursor.fetchall()]

        cursor.execute("SELECT * FROM feedback_tables")
        rows = cursor.fetchall()
        cursor.close()
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

# ---------------- New helpers: delete user / cafe / feedback / update cafe ----------------

def delete_user_by_id_helper(id_user):
    try:
        db = get_db_connection()
        cursor = db.cursor()
        cursor.execute("DELETE FROM user_tables WHERE id_user = %s", (id_user,))
        db.commit()
        deleted = cursor.rowcount
        cursor.close()
        db.close()
        if deleted:
            return {"message": f"User {id_user} berhasil dihapus"}, 200
        else:
            return {"error": "User tidak ditemukan"}, 404
    except Exception as e:
        return {"error": str(e)}, 500

def delete_cafe_by_nomor_helper(nomor):
    try:
        db = get_db_connection()
        cursor = db.cursor()
        cursor.execute("SELECT gambar_kafe FROM cafe_tables WHERE nomor = %s", (nomor,))
        row = cursor.fetchone()
        if row and row[0]:
            path = row[0]
            if isinstance(path, str) and path.startswith("/uploads/cafes/"):
                fname = os.path.basename(path)
                full = os.path.join(UPLOAD_FOLDER, fname)
                try:
                    if os.path.exists(full):
                        os.remove(full)
                except Exception as e:
                    print("Failed to remove cafe image file:", e)

        cursor.execute("DELETE FROM cafe_tables WHERE nomor = %s", (nomor,))
        db.commit()
        deleted = cursor.rowcount
        cursor.close()
        db.close()
        if deleted:
            return {"message": f"Cafe nomor {nomor} berhasil dihapus"}, 200
        else:
            return {"error": "Cafe tidak ditemukan"}, 404
    except Exception as e:
        return {"error": str(e)}, 500

def update_cafe_by_nomor_helper(nomor, data):
    if not isinstance(data, dict) or not data:
        return {"error": "Payload harus berformat JSON dan berisi field untuk diupdate"}, 400

    try:
        db = get_db_connection()
        cursor = db.cursor()
        cursor.execute("SHOW COLUMNS FROM cafe_tables")
        columns = [col[0] for col in cursor.fetchall()]
        # exclude primary key 'nomor'
        valid_cols = [c for c in columns if c.lower() != "nomor" and c in data]

        if not valid_cols:
            cursor.close()
            db.close()
            return {"error": "Tidak ada field valid untuk diupdate"}, 400

        set_clauses = ", ".join([f"{col} = %s" for col in valid_cols])
        params = [data[col] for col in valid_cols]
        params.append(nomor)

        query = f"UPDATE cafe_tables SET {set_clauses} WHERE nomor = %s"
        cursor.execute(query, tuple(params))
        db.commit()
        updated = cursor.rowcount
        cursor.close()
        db.close()

        if updated:
            return {"message": f"Cafe nomor {nomor} berhasil diperbarui"}, 200
        else:
            return {"error": "Cafe tidak ditemukan atau tidak ada perubahan"}, 404
    except Exception as e:
        return {"error": str(e)}, 500

def delete_feedback_by_id_helper(id_feedback):
    try:
        db = get_db_connection()
        cursor = db.cursor()
        cursor.execute("DELETE FROM feedback_tables WHERE id_feedback = %s", (id_feedback,))
        db.commit()
        deleted = cursor.rowcount
        cursor.close()
        db.close()
        if deleted:
            return {"message": f"Feedback {id_feedback} berhasil dihapus"}, 200
        else:
            return {"error": "Feedback tidak ditemukan"}, 404
    except Exception as e:
        return {"error": str(e)}, 500

# ---------------- Upload image helpers ----------------

def get_existing_cafe_image(nomor):
    try:
        db = get_db_connection()
        cursor = db.cursor()
        cursor.execute("SELECT gambar_kafe FROM cafe_tables WHERE nomor = %s", (nomor,))
        row = cursor.fetchone()
        cursor.close()
        db.close()
        if row:
            return row[0]
        return None
    except Exception as e:
        print("Error fetching existing cafe image:", e)
        return None

def update_cafe_image_path(nomor, image_path):
    try:
        db = get_db_connection()
        cursor = db.cursor()
        query = "UPDATE cafe_tables SET gambar_kafe = %s WHERE nomor = %s"
        cursor.execute(query, (image_path, nomor))
        db.commit()
        updated = cursor.rowcount
        cursor.close()
        db.close()
        return bool(updated)
    except Exception as e:
        print("Error updating gambar_kafe:", e)
        return False

# ---------------- Routes (endpoints) ----------------

# Feedback endpoints
@app.route('/api/feedback', methods=['POST'])
def api_add_feedback():
    data = request.get_json() or {}
    result, status = add_user_feedback_helper(data)
    return jsonify(result), status

@app.route('/api/feedbacks', methods=['GET'])
def api_get_all_feedbacks():
    feedbacks = get_all_feedbacks()
    if isinstance(feedbacks, dict) and feedbacks.get("error"):
        return jsonify(feedbacks), 500
    return jsonify(feedbacks), 200

@app.route('/api/feedback/<int:id_feedback>', methods=['DELETE'])
def api_delete_feedback(id_feedback):
    result, status = delete_feedback_by_id_helper(id_feedback)
    return jsonify(result), status

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
    data = request.get_json() or {}
    result, status = add_favorite_menu_helper(data)
    return jsonify(result), status

# Visited Cafes
@app.route('/api/visited/<int:id_user>', methods=['GET'])
def api_get_visited_cafe(id_user):
    result = get_visited_cafe(id_user)
    if result is None:
        return jsonify([]), 200
    if isinstance(result, dict) and result.get("error"):
        return jsonify(result), 500
    return jsonify(result), 200

@app.route('/api/visited/<int:id_user>', methods=['POST'])
def api_add_visited_cafe(id_user):
    data = request.get_json() or {}
    cafe_id = data.get("id_cafe")
    if cafe_id is None:
        return jsonify({"error": "Field id_cafe wajib diisi"}), 400
    result, status = add_visited_cafe_helper(id_user, cafe_id)
    return jsonify(result), status

@app.route('/api/user/preferences', methods=['POST'])
def api_update_user_preferences():
    data = request.get_json() or {}
    result, status = update_user_preferences_helper(data)
    return jsonify(result), status

# Users
def get_all_users():
    try:
        db = get_db_connection()
        cursor = db.cursor()
        cursor.execute("SHOW COLUMNS FROM user_tables")
        columns = [col[0] for col in cursor.fetchall()]

        cursor.execute("SELECT * FROM user_tables")
        rows = cursor.fetchall()
        cursor.close()
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

@app.route('/api/users/<int:id_user>', methods=['GET', 'DELETE'])
def api_user_by_id(id_user):
    if request.method == 'GET':
        user = get_user_by_id(id_user)
        if user:
            return jsonify(user), 200
        else:
            return jsonify({"error": "User not found"}), 404
    elif request.method == 'DELETE':
        result, status = delete_user_by_id_helper(id_user)
        return jsonify(result), status

# Admin endpoints
@app.route('/api/login_admin', methods=['POST'])
def api_login_admin():
    data = request.get_json() or {}
    result, status = login_admin_helper(data)
    return jsonify(result), status

@app.route('/api/admin/<int:id_admin>', methods=['GET'])
def api_get_admin(id_admin):
    admin = get_admin_by_id(id_admin)
    if isinstance(admin, dict) and admin.get("error"):
        return jsonify(admin), 500
    if admin:
        return jsonify(admin), 200
    else:
        return jsonify({"error": "Admin not found"}), 404

# Sentiment
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

# Data endpoints (cafes / menus)
@app.route('/api/data', methods=['GET'])
def api_data():
    return jsonify(get_data()), 200

@app.route('/api/menus', methods=['GET'])
def api_menu():
    return jsonify(get_menu()), 200

@app.route('/api/menu/<int:id_cafe>', methods=['GET'])
def api_menu_by_id_route(id_cafe):
    menus = get_menu_by_id(id_cafe)
    if menus is None:
        return jsonify([]), 200
    return jsonify(menus), 200

@app.route('/api/search/<keyword>', methods=['GET'])
def api_search(keyword):
    return jsonify(get_data(keyword)), 200

# GET / PUT / DELETE cafe by nomor + upload image
@app.route('/api/cafe/<int:nomor>', methods=['GET', 'PUT', 'DELETE'])
def api_cafe(nomor):
    if request.method == 'GET':
        cafe = get_data_by_id(nomor)
        if cafe:
            return jsonify(cafe), 200
        else:
            return jsonify({"error": "Cafe not found"}), 404

    if request.method == 'PUT':
        data = request.get_json() or {}
        result, status = update_cafe_by_nomor_helper(nomor, data)
        return jsonify(result), status

    if request.method == 'DELETE':
        result, status = delete_cafe_by_nomor_helper(nomor)
        return jsonify(result), status

# Upload image for a cafe
@app.route('/api/cafe/<int:nomor>/upload_image', methods=['POST'])
def api_upload_cafe_image(nomor):
    cafe = get_data_by_id(nomor)
    if not cafe:
        return jsonify({"error": "Cafe not found"}), 404

    if "image" not in request.files:
        return jsonify({"error": "No file part with key 'image'"}), 400
    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": f"File extension not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"}), 400

    filename_secure = secure_filename(file.filename)
    ext = filename_secure.rsplit(".", 1)[-1].lower()
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    save_path = os.path.join(UPLOAD_FOLDER, unique_name)

    try:
        # attempt to remove previous image file if exists
        prev_path = get_existing_cafe_image(nomor)
        if prev_path and isinstance(prev_path, str) and prev_path.startswith("/uploads/cafes/"):
            prev_fname = os.path.basename(prev_path)
            prev_full = os.path.join(UPLOAD_FOLDER, prev_fname)
            if os.path.exists(prev_full):
                try:
                    os.remove(prev_full)
                except Exception as e:
                    print("Failed to remove previous image:", e)

        file.save(save_path)
        db_rel_path = f"/uploads/cafes/{unique_name}"
        ok = update_cafe_image_path(nomor, db_rel_path)
        if not ok:
            try:
                os.remove(save_path)
            except:
                pass
            return jsonify({"error": "Failed to update database"}), 500

        return jsonify({"message": "Image uploaded", "gambar_kafe": db_rel_path}), 201

    except Exception as e:
        print("Error saving uploaded file:", e)
        return jsonify({"error": str(e)}), 500

# Serve uploaded images
@app.route('/uploads/cafes/<path:filename>', methods=['GET'])
def serve_cafe_image(filename):
    try:
        return send_from_directory(UPLOAD_FOLDER, filename)
    except Exception:
        abort(404)

# Registration / login endpoints
@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json() or {}
    result, status = register_user_helper(data)
    return jsonify(result), status

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    result, status = login_user_helper(data)
    return jsonify(result), status

# Reviews endpoint example
@app.route('/api/reviews/<int:id_kafe>', methods=['GET'])
def api_reviews(id_kafe):
    return jsonify(get_reviews(id_kafe)), 200

# ----------------- Run -----------------
if __name__ == "__main__":
    app.run(port=8080, debug=True)
