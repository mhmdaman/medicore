"""
MediCore — Hospital Patient Record System
Backend: Python + Flask + MySQL
Tables: patients, doctors, wards, medications, users
Run: python3 server.py
Open: http://localhost:8000
"""

import uuid
import os
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import mysql.connector
from mysql.connector import pooling

app = Flask(__name__, static_folder='.')
CORS(app)

# ══════════════════════════════════════════════
#   SET YOUR MYSQL PASSWORD BELOW
# ══════════════════════════════════════════════
DB_CONFIG = {
    "host":     "localhost",
    "port":     3306,
    "user":     "root",
    "password": "sqlpassword",   # <-- your password
    "database": "medicore_db",
    "charset":  "utf8mb4",
}
# ══════════════════════════════════════════════

connection_pool = pooling.MySQLConnectionPool(
    pool_name="medicore_pool",
    pool_size=5,
    **DB_CONFIG
)

# ─── DB HELPERS ───────────────────────────────────────────────────────────────

def get_conn():
    return connection_pool.get_connection()


def query(sql, params=(), fetchone=False, fetchall=False, commit=False):
    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, params)
        result = None
        if fetchone:
            result = cur.fetchone()
        elif fetchall:
            result = cur.fetchall()
        if commit:
            conn.commit()
            result = cur.rowcount
        return result
    finally:
        cur.close()
        conn.close()


def serialize(row):
    if not row:
        return row
    for key in ('created_at', 'updated_at', 'start_date', 'end_date'):
        if key in row and row[key] and hasattr(row[key], 'isoformat'):
            row[key] = row[key].isoformat()
    return row


def ok(data=None, message="OK", code=200):
    return jsonify({"success": True, "message": message, "data": data}), code


def err(message="Error", code=400):
    return jsonify({"success": False, "message": message, "data": None}), code


def gen_id():
    return f"MC-{uuid.uuid4().hex[:10].upper()}"


def now():
    return datetime.now()


# ─── DATABASE INIT ────────────────────────────────────────────────────────────

def init_db():
    # USERS
    query("""
        CREATE TABLE IF NOT EXISTS users (
            id          VARCHAR(30)   PRIMARY KEY,
            name        VARCHAR(150)  NOT NULL,
            email       VARCHAR(150)  NOT NULL UNIQUE,
            password    VARCHAR(255)  NOT NULL,
            role        VARCHAR(50)   DEFAULT 'Staff',
            created_at  DATETIME      NOT NULL,
            updated_at  DATETIME      NOT NULL,
            INDEX idx_user_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """, commit=True)

    # DOCTORS
    query("""
        CREATE TABLE IF NOT EXISTS doctors (
            id          VARCHAR(30)   PRIMARY KEY,
            name        VARCHAR(150)  NOT NULL,
            specialty   VARCHAR(100),
            contact     VARCHAR(20),
            email       VARCHAR(150),
            department  VARCHAR(100),
            created_at  DATETIME      NOT NULL,
            updated_at  DATETIME      NOT NULL,
            INDEX idx_doctor_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """, commit=True)

    # WARDS
    query("""
        CREATE TABLE IF NOT EXISTS wards (
            id          VARCHAR(30)   PRIMARY KEY,
            name        VARCHAR(100)  NOT NULL,
            type        VARCHAR(50),
            capacity    INT           DEFAULT 10,
            floor       INT,
            created_at  DATETIME      NOT NULL,
            INDEX idx_ward_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """, commit=True)

    # PATIENTS
    query("""
        CREATE TABLE IF NOT EXISTS patients (
            id          VARCHAR(30)   PRIMARY KEY,
            name        VARCHAR(150)  NOT NULL,
            age         INT           NOT NULL,
            gender      VARCHAR(20)   NOT NULL,
            blood       VARCHAR(5),
            contact     VARCHAR(20)   NOT NULL,
            email       VARCHAR(150),
            address     TEXT,
            diagnosis   VARCHAR(255)  NOT NULL,
            doctor      VARCHAR(150),
            ward        VARCHAR(100),
            status      VARCHAR(30)   DEFAULT 'Admitted',
            history     TEXT,
            treatment   TEXT,
            created_at  DATETIME      NOT NULL,
            updated_at  DATETIME      NOT NULL,
            INDEX idx_name   (name),
            INDEX idx_status (status),
            INDEX idx_gender (gender),
            INDEX idx_blood  (blood)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """, commit=True)

    # MEDICATIONS
    query("""
        CREATE TABLE IF NOT EXISTS medications (
            id           VARCHAR(30)   PRIMARY KEY,
            patient_id   VARCHAR(30)   NOT NULL,
            medicine     VARCHAR(150)  NOT NULL,
            dosage       VARCHAR(100),
            frequency    VARCHAR(100),
            start_date   DATE,
            end_date     DATE,
            notes        TEXT,
            created_at   DATETIME      NOT NULL,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
            INDEX idx_med_patient (patient_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """, commit=True)

    print("  ✔  All tables ready.")


# ─── STATIC FILES ─────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('.', filename)


# ══════════════════════════════════════════════════════════════════════════════
#  PATIENTS API
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/patients', methods=['GET'])
def get_patients():
    q      = request.args.get('q',      '').strip()
    gender = request.args.get('gender', '').strip()
    status = request.args.get('status', '').strip()
    blood  = request.args.get('blood',  '').strip()
    limit  = int(request.args.get('limit',  100))
    offset = int(request.args.get('offset', 0))

    sql    = "SELECT * FROM patients WHERE 1=1"
    params = []

    if q:
        sql += " AND (name LIKE %s OR diagnosis LIKE %s OR id LIKE %s OR doctor LIKE %s)"
        like = f"%{q}%"
        params += [like, like, like, like]
    if gender: sql += " AND gender = %s"; params.append(gender)
    if status: sql += " AND status = %s"; params.append(status)
    if blood:  sql += " AND blood  = %s"; params.append(blood)

    sql += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
    params += [limit, offset]

    rows = query(sql, params, fetchall=True) or []
    return ok([serialize(r) for r in rows])


@app.route('/api/patients/<string:pid>', methods=['GET'])
def get_patient(pid):
    row = query("SELECT * FROM patients WHERE id = %s", (pid,), fetchone=True)
    if not row:
        return err("Patient not found", 404)
    # Also fetch medications for this patient
    meds = query("SELECT * FROM medications WHERE patient_id = %s ORDER BY created_at DESC", (pid,), fetchall=True) or []
    row  = serialize(row)
    row['medications'] = [serialize(m) for m in meds]
    return ok(row)


@app.route('/api/patients', methods=['POST'])
def create_patient():
    body = request.get_json(silent=True)
    if not body:
        return err("Invalid JSON body")
    for field in ['name', 'age', 'gender', 'contact', 'diagnosis']:
        if not body.get(field):
            return err(f"Field '{field}' is required")
    pid = gen_id()
    ts  = now()
    try:
        query("""
            INSERT INTO patients
              (id, name, age, gender, blood, contact, email, address,
               diagnosis, doctor, ward, status, history, treatment, created_at, updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            pid, body['name'].strip(), int(body['age']), body['gender'],
            body.get('blood',''), body['contact'].strip(),
            body.get('email','').strip(), body.get('address','').strip(),
            body['diagnosis'].strip(), body.get('doctor','').strip(),
            body.get('ward','').strip(), body.get('status','Admitted'),
            body.get('history','').strip(), body.get('treatment','').strip(),
            ts, ts
        ), commit=True)
    except Exception as e:
        return err(f"Database error: {str(e)}", 500)
    row = query("SELECT * FROM patients WHERE id = %s", (pid,), fetchone=True)
    return ok(serialize(row), "Patient registered successfully", 201)


@app.route('/api/patients/<string:pid>', methods=['PUT'])
def update_patient(pid):
    body = request.get_json(silent=True)
    if not body:
        return err("Invalid JSON body")
    if not query("SELECT id FROM patients WHERE id = %s", (pid,), fetchone=True):
        return err("Patient not found", 404)
    allowed = ['name','age','gender','blood','contact','email','address',
               'diagnosis','doctor','ward','status','history','treatment']
    updates, params = [], []
    for f in allowed:
        if f in body:
            updates.append(f"`{f}` = %s")
            params.append(body[f])
    if not updates:
        return err("No fields to update")
    updates.append("updated_at = %s")
    params += [now(), pid]
    try:
        query(f"UPDATE patients SET {', '.join(updates)} WHERE id = %s", params, commit=True)
    except Exception as e:
        return err(f"Database error: {str(e)}", 500)
    row = query("SELECT * FROM patients WHERE id = %s", (pid,), fetchone=True)
    return ok(serialize(row), "Patient updated successfully")


@app.route('/api/patients/<string:pid>', methods=['DELETE'])
def delete_patient(pid):
    row = query("SELECT id, name FROM patients WHERE id = %s", (pid,), fetchone=True)
    if not row:
        return err("Patient not found", 404)
    query("DELETE FROM patients WHERE id = %s", (pid,), commit=True)
    return ok({"id": pid}, f"Record for {row['name']} deleted")


# ══════════════════════════════════════════════════════════════════════════════
#  DOCTORS API
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/doctors', methods=['GET'])
def get_doctors():
    q = request.args.get('q', '').strip()
    sql = "SELECT * FROM doctors WHERE 1=1"
    params = []
    if q:
        sql += " AND (name LIKE %s OR specialty LIKE %s OR department LIKE %s)"
        like = f"%{q}%"
        params += [like, like, like]
    sql += " ORDER BY name ASC"
    rows = query(sql, params, fetchall=True) or []
    return ok([serialize(r) for r in rows])


@app.route('/api/doctors/<string:did>', methods=['GET'])
def get_doctor(did):
    row = query("SELECT * FROM doctors WHERE id = %s", (did,), fetchone=True)
    if not row:
        return err("Doctor not found", 404)
    return ok(serialize(row))


@app.route('/api/doctors', methods=['POST'])
def create_doctor():
    body = request.get_json(silent=True)
    if not body:
        return err("Invalid JSON body")
    if not body.get('name'):
        return err("Field 'name' is required")
    did = gen_id()
    ts  = now()
    try:
        query("""
            INSERT INTO doctors (id, name, specialty, contact, email, department, created_at, updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            did, body['name'].strip(),
            body.get('specialty','').strip(), body.get('contact','').strip(),
            body.get('email','').strip(),     body.get('department','').strip(),
            ts, ts
        ), commit=True)
    except Exception as e:
        return err(f"Database error: {str(e)}", 500)
    row = query("SELECT * FROM doctors WHERE id = %s", (did,), fetchone=True)
    return ok(serialize(row), "Doctor added successfully", 201)


@app.route('/api/doctors/<string:did>', methods=['PUT'])
def update_doctor(did):
    body = request.get_json(silent=True)
    if not body:
        return err("Invalid JSON body")
    if not query("SELECT id FROM doctors WHERE id = %s", (did,), fetchone=True):
        return err("Doctor not found", 404)
    allowed = ['name','specialty','contact','email','department']
    updates, params = [], []
    for f in allowed:
        if f in body:
            updates.append(f"`{f}` = %s")
            params.append(body[f])
    if not updates:
        return err("No fields to update")
    updates.append("updated_at = %s")
    params += [now(), did]
    query(f"UPDATE doctors SET {', '.join(updates)} WHERE id = %s", params, commit=True)
    row = query("SELECT * FROM doctors WHERE id = %s", (did,), fetchone=True)
    return ok(serialize(row), "Doctor updated successfully")


@app.route('/api/doctors/<string:did>', methods=['DELETE'])
def delete_doctor(did):
    row = query("SELECT id, name FROM doctors WHERE id = %s", (did,), fetchone=True)
    if not row:
        return err("Doctor not found", 404)
    query("DELETE FROM doctors WHERE id = %s", (did,), commit=True)
    return ok({"id": did}, f"Doctor {row['name']} deleted")


# ══════════════════════════════════════════════════════════════════════════════
#  WARDS API
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/wards', methods=['GET'])
def get_wards():
    rows = query("SELECT * FROM wards ORDER BY name ASC", fetchall=True) or []
    return ok([serialize(r) for r in rows])


@app.route('/api/wards/<string:wid>', methods=['GET'])
def get_ward(wid):
    row = query("SELECT * FROM wards WHERE id = %s", (wid,), fetchone=True)
    if not row:
        return err("Ward not found", 404)
    return ok(serialize(row))


@app.route('/api/wards', methods=['POST'])
def create_ward():
    body = request.get_json(silent=True)
    if not body:
        return err("Invalid JSON body")
    if not body.get('name'):
        return err("Field 'name' is required")
    wid = gen_id()
    ts  = now()
    try:
        query("""
            INSERT INTO wards (id, name, type, capacity, floor, created_at)
            VALUES (%s,%s,%s,%s,%s,%s)
        """, (
            wid, body['name'].strip(),
            body.get('type','').strip(),
            int(body.get('capacity', 10)),
            int(body.get('floor', 1)),
            ts
        ), commit=True)
    except Exception as e:
        return err(f"Database error: {str(e)}", 500)
    row = query("SELECT * FROM wards WHERE id = %s", (wid,), fetchone=True)
    return ok(serialize(row), "Ward added successfully", 201)


@app.route('/api/wards/<string:wid>', methods=['PUT'])
def update_ward(wid):
    body = request.get_json(silent=True)
    if not body:
        return err("Invalid JSON body")
    if not query("SELECT id FROM wards WHERE id = %s", (wid,), fetchone=True):
        return err("Ward not found", 404)
    allowed = ['name','type','capacity','floor']
    updates, params = [], []
    for f in allowed:
        if f in body:
            updates.append(f"`{f}` = %s")
            params.append(body[f])
    if not updates:
        return err("No fields to update")
    params.append(wid)
    query(f"UPDATE wards SET {', '.join(updates)} WHERE id = %s", params, commit=True)
    row = query("SELECT * FROM wards WHERE id = %s", (wid,), fetchone=True)
    return ok(serialize(row), "Ward updated successfully")


@app.route('/api/wards/<string:wid>', methods=['DELETE'])
def delete_ward(wid):
    row = query("SELECT id, name FROM wards WHERE id = %s", (wid,), fetchone=True)
    if not row:
        return err("Ward not found", 404)
    query("DELETE FROM wards WHERE id = %s", (wid,), commit=True)
    return ok({"id": wid}, f"Ward {row['name']} deleted")


# ══════════════════════════════════════════════════════════════════════════════
#  MEDICATIONS API
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/medications', methods=['GET'])
def get_medications():
    patient_id = request.args.get('patient_id', '').strip()
    sql = "SELECT * FROM medications WHERE 1=1"
    params = []
    if patient_id:
        sql += " AND patient_id = %s"
        params.append(patient_id)
    sql += " ORDER BY created_at DESC"
    rows = query(sql, params, fetchall=True) or []
    return ok([serialize(r) for r in rows])


@app.route('/api/medications/<string:mid>', methods=['GET'])
def get_medication(mid):
    row = query("SELECT * FROM medications WHERE id = %s", (mid,), fetchone=True)
    if not row:
        return err("Medication not found", 404)
    return ok(serialize(row))


@app.route('/api/medications', methods=['POST'])
def create_medication():
    body = request.get_json(silent=True)
    if not body:
        return err("Invalid JSON body")
    for field in ['patient_id', 'medicine']:
        if not body.get(field):
            return err(f"Field '{field}' is required")
    if not query("SELECT id FROM patients WHERE id = %s", (body['patient_id'],), fetchone=True):
        return err("Patient not found", 404)
    mid = gen_id()
    ts  = now()
    try:
        query("""
            INSERT INTO medications
              (id, patient_id, medicine, dosage, frequency, start_date, end_date, notes, created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            mid, body['patient_id'], body['medicine'].strip(),
            body.get('dosage','').strip(),    body.get('frequency','').strip(),
            body.get('start_date') or None,   body.get('end_date') or None,
            body.get('notes','').strip(),      ts
        ), commit=True)
    except Exception as e:
        return err(f"Database error: {str(e)}", 500)
    row = query("SELECT * FROM medications WHERE id = %s", (mid,), fetchone=True)
    return ok(serialize(row), "Medication added successfully", 201)


@app.route('/api/medications/<string:mid>', methods=['PUT'])
def update_medication(mid):
    body = request.get_json(silent=True)
    if not body:
        return err("Invalid JSON body")
    if not query("SELECT id FROM medications WHERE id = %s", (mid,), fetchone=True):
        return err("Medication not found", 404)
    allowed = ['medicine','dosage','frequency','start_date','end_date','notes']
    updates, params = [], []
    for f in allowed:
        if f in body:
            updates.append(f"`{f}` = %s")
            params.append(body[f])
    if not updates:
        return err("No fields to update")
    params.append(mid)
    query(f"UPDATE medications SET {', '.join(updates)} WHERE id = %s", params, commit=True)
    row = query("SELECT * FROM medications WHERE id = %s", (mid,), fetchone=True)
    return ok(serialize(row), "Medication updated successfully")


@app.route('/api/medications/<string:mid>', methods=['DELETE'])
def delete_medication(mid):
    row = query("SELECT id FROM medications WHERE id = %s", (mid,), fetchone=True)
    if not row:
        return err("Medication not found", 404)
    query("DELETE FROM medications WHERE id = %s", (mid,), commit=True)
    return ok({"id": mid}, "Medication deleted")


# ══════════════════════════════════════════════════════════════════════════════
#  USERS API
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/users', methods=['GET'])
def get_users():
    rows = query("SELECT id, name, email, role, created_at, updated_at FROM users ORDER BY name ASC", fetchall=True) or []
    return ok([serialize(r) for r in rows])


@app.route('/api/users', methods=['POST'])
def create_user():
    body = request.get_json(silent=True)
    if not body:
        return err("Invalid JSON body")
    for field in ['name', 'email', 'password']:
        if not body.get(field):
            return err(f"Field '{field}' is required")
    uid = gen_id()
    ts  = now()
    try:
        query("""
            INSERT INTO users (id, name, email, password, role, created_at, updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
        """, (
            uid, body['name'].strip(), body['email'].strip(),
            body['password'], body.get('role','Staff'), ts, ts
        ), commit=True)
    except Exception as e:
        return err(f"Database error: {str(e)}", 500)
    row = query("SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = %s", (uid,), fetchone=True)
    return ok(serialize(row), "User created successfully", 201)


@app.route('/api/users/<string:uid>', methods=['DELETE'])
def delete_user(uid):
    row = query("SELECT id, name FROM users WHERE id = %s", (uid,), fetchone=True)
    if not row:
        return err("User not found", 404)
    query("DELETE FROM users WHERE id = %s", (uid,), commit=True)
    return ok({"id": uid}, f"User {row['name']} deleted")


# ══════════════════════════════════════════════════════════════════════════════
#  STATS API
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/stats', methods=['GET'])
def get_stats():
    today = datetime.now().strftime('%Y-%m-%d')
    return ok({
        "total":      query("SELECT COUNT(*) AS c FROM patients",                                          fetchone=True)['c'],
        "today":      query("SELECT COUNT(*) AS c FROM patients WHERE DATE(created_at) = %s", (today,),   fetchone=True)['c'],
        "discharged": query("SELECT COUNT(*) AS c FROM patients WHERE status = 'Discharged'",             fetchone=True)['c'],
        "critical":   query("SELECT COUNT(*) AS c FROM patients WHERE status = 'Critical'",               fetchone=True)['c'],
        "male":       query("SELECT COUNT(*) AS c FROM patients WHERE gender = 'Male'",                   fetchone=True)['c'],
        "female":     query("SELECT COUNT(*) AS c FROM patients WHERE gender = 'Female'",                 fetchone=True)['c'],
        "doctors":    query("SELECT COUNT(*) AS c FROM doctors",                                          fetchone=True)['c'],
        "wards":      query("SELECT COUNT(*) AS c FROM wards",                                            fetchone=True)['c'],
        "medications":query("SELECT COUNT(*) AS c FROM medications",                                      fetchone=True)['c'],
        "users":      query("SELECT COUNT(*) AS c FROM users",                                            fetchone=True)['c'],
    })


# ─── RUN ─────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    print("\n  ╔═══════════════════════════════════════════╗")
    print("  ║    MediCore — Patient Record System       ║")
    print("  ║    Backend  :  Flask + MySQL              ║")
    print("  ║    Tables   :  5 tables                   ║")
    print("  ║    Open     :  http://localhost:8000      ║")
    print("  ╚═══════════════════════════════════════════╝\n")
    init_db()
    app.run(debug=True, port=8000)