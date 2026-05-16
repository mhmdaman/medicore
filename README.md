# 🏥 MediCore — Hospital Patient Record System

> A lightweight, full-stack Hospital Patient Record Management System built with **Flask**, **MySQL**, and **Vanilla JS**. Designed for small to mid-sized clinics to manage patients, doctors, wards, medications, and users from a single interface.

---

## 📁 Project Structure

```
medicore/
├── app.py                  # Flask application entry point
├── config.py               # DB config & app settings
├── requirements.txt        # Python dependencies
├── static/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── main.js
└── templates/
    ├── base.html
    ├── index.html
    ├── patients.html
    ├── doctors.html
    ├── wards.html
    ├── medications.html
    └── users.html
```

---

## ⚙️ Tech Stack

| Layer      | Technology          |
|------------|---------------------|
| Backend    | Python 3.x, Flask   |
| Database   | MySQL 8.x           |
| Frontend   | HTML5, CSS3, Vanilla JS |
| ORM        | Raw SQL via mysql-connector-python |
| Port       | `8000`              |

---

## 🗃️ Database Schema

MediCore uses **5 core tables**, normalized to **3NF**.

### Entity Relationship Overview

```
users
  │
  ▼
patients ──────────── wards
  │
  ├──────────────────── medications
  │
  └────── doctors
```

---

## 🛠️ Full SQL Setup

### 1. Create Database

```sql
CREATE DATABASE IF NOT EXISTS medicore
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE medicore;
```

---

### 2. Create Tables

#### 🔐 `users` — System login accounts

```sql
CREATE TABLE IF NOT EXISTS users (
    user_id     INT AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(50)  NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,          -- store hashed passwords (bcrypt)
    role        ENUM('admin', 'doctor', 'nurse', 'receptionist') NOT NULL DEFAULT 'receptionist',
    full_name   VARCHAR(100) NOT NULL,
    email       VARCHAR(100) UNIQUE,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1
);
```

---

#### 🏩 `wards` — Hospital ward/room management

```sql
CREATE TABLE IF NOT EXISTS wards (
    ward_id      INT AUTO_INCREMENT PRIMARY KEY,
    ward_name    VARCHAR(100) NOT NULL,
    ward_type    ENUM('general', 'icu', 'pediatric', 'maternity', 'surgical', 'emergency') NOT NULL,
    total_beds   INT          NOT NULL DEFAULT 10,
    occupied_beds INT         NOT NULL DEFAULT 0,
    floor_number INT,
    notes        TEXT,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_beds CHECK (occupied_beds <= total_beds)
);
```

---

#### 👨‍⚕️ `doctors` — Doctor profiles and specializations

```sql
CREATE TABLE IF NOT EXISTS doctors (
    doctor_id      INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT          UNIQUE,                  -- links to users table (optional)
    full_name      VARCHAR(100) NOT NULL,
    specialization VARCHAR(100) NOT NULL,
    phone          VARCHAR(20),
    email          VARCHAR(100) UNIQUE,
    license_number VARCHAR(50)  NOT NULL UNIQUE,
    available      TINYINT(1)   NOT NULL DEFAULT 1,
    joined_date    DATE,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);
```

---

#### 🧑‍🦽 `patients` — Core patient records

```sql
CREATE TABLE IF NOT EXISTS patients (
    patient_id     INT AUTO_INCREMENT PRIMARY KEY,
    full_name      VARCHAR(100) NOT NULL,
    dob            DATE         NOT NULL,
    gender         ENUM('male', 'female', 'other') NOT NULL,
    blood_group    ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-'),
    phone          VARCHAR(20),
    email          VARCHAR(100),
    address        TEXT,
    emergency_contact_name  VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    doctor_id      INT,                                  -- assigned doctor
    ward_id        INT,                                  -- assigned ward
    admission_date DATE         NOT NULL DEFAULT (CURRENT_DATE),
    discharge_date DATE,
    status         ENUM('admitted', 'discharged', 'outpatient') NOT NULL DEFAULT 'outpatient',
    notes          TEXT,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    FOREIGN KEY (ward_id) REFERENCES wards(ward_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);
```

---

#### 💊 `medications` — Medication prescriptions per patient

```sql
CREATE TABLE IF NOT EXISTS medications (
    medication_id  INT AUTO_INCREMENT PRIMARY KEY,
    patient_id     INT          NOT NULL,
    prescribed_by  INT,                                  -- doctor_id
    drug_name      VARCHAR(150) NOT NULL,
    dosage         VARCHAR(100) NOT NULL,               -- e.g. "500mg twice daily"
    route          ENUM('oral','iv','im','topical','inhalation','sublingual') NOT NULL DEFAULT 'oral',
    start_date     DATE         NOT NULL DEFAULT (CURRENT_DATE),
    end_date       DATE,
    frequency      VARCHAR(100),                        -- e.g. "every 8 hours"
    notes          TEXT,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    FOREIGN KEY (prescribed_by) REFERENCES doctors(doctor_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);
```

---

### 3. Indexes (Performance)

```sql
-- Speed up patient lookups by name and status
CREATE INDEX idx_patients_name   ON patients(full_name);
CREATE INDEX idx_patients_status ON patients(status);
CREATE INDEX idx_patients_doctor ON patients(doctor_id);

-- Speed up medication lookups by patient
CREATE INDEX idx_medications_patient ON medications(patient_id);

-- Speed up doctor lookup by specialization
CREATE INDEX idx_doctors_specialization ON doctors(specialization);
```

---

### 4. Seed Data

```sql
-- Default admin user (password: admin123 — replace with bcrypt hash in production)
INSERT INTO users (username, password, role, full_name, email)
VALUES (
    'admin',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',  -- bcrypt of 'admin123'
    'admin',
    'System Administrator',
    'admin@medicore.local'
);

-- Sample wards
INSERT INTO wards (ward_name, ward_type, total_beds, floor_number) VALUES
('Ward A - General',   'general',   20, 1),
('Ward B - ICU',       'icu',        8, 2),
('Ward C - Pediatric', 'pediatric', 15, 1),
('Ward D - Maternity', 'maternity', 12, 3),
('Ward E - Surgical',  'surgical',  10, 2);

-- Sample doctors
INSERT INTO doctors (full_name, specialization, phone, email, license_number, joined_date) VALUES
('Dr. Arjun Menon',   'Cardiology',       '9876543210', 'arjun@medicore.local',  'KER-MED-001', '2020-06-01'),
('Dr. Priya Nair',    'Pediatrics',       '9876543211', 'priya@medicore.local',   'KER-MED-002', '2019-03-15'),
('Dr. Rahul Krishnan','General Surgery',  '9876543212', 'rahul@medicore.local',   'KER-MED-003', '2021-08-20'),
('Dr. Sneha Das',     'Obstetrics',       '9876543213', 'sneha@medicore.local',   'KER-MED-004', '2022-01-10');

-- Sample patients
INSERT INTO patients (full_name, dob, gender, blood_group, phone, doctor_id, ward_id, admission_date, status) VALUES
('Ravi Kumar',    '1985-04-12', 'male',   'O+', '9600001111', 1, 1, CURRENT_DATE, 'admitted'),
('Anjali Mohan',  '1992-07-23', 'female', 'A+', '9600002222', 2, 3, CURRENT_DATE, 'admitted'),
('Suresh Pillai', '1970-11-05', 'male',   'B-', '9600003333', 3, 5, CURRENT_DATE, 'admitted'),
('Meera Joshi',   '2000-01-30', 'female', 'AB+','9600004444', 1, NULL, NULL, 'outpatient');

-- Sample medications
INSERT INTO medications (patient_id, prescribed_by, drug_name, dosage, route, start_date, frequency) VALUES
(1, 1, 'Aspirin',      '100mg',    'oral', CURRENT_DATE, 'once daily'),
(1, 1, 'Atorvastatin', '20mg',     'oral', CURRENT_DATE, 'once at night'),
(2, 2, 'Amoxicillin',  '250mg',    'oral', CURRENT_DATE, 'every 8 hours'),
(3, 3, 'Morphine',     '10mg/5ml', 'iv',   CURRENT_DATE, 'every 6 hours as needed');
```

---

### 5. Useful Queries

```sql
-- All admitted patients with their doctor and ward
SELECT
    p.patient_id,
    p.full_name        AS patient,
    p.status,
    d.full_name        AS doctor,
    d.specialization,
    w.ward_name,
    p.admission_date
FROM patients p
LEFT JOIN doctors d ON p.doctor_id = d.doctor_id
LEFT JOIN wards  w ON p.ward_id   = w.ward_id
WHERE p.status = 'admitted'
ORDER BY p.admission_date DESC;

-- Bed occupancy per ward
SELECT
    ward_name,
    ward_type,
    total_beds,
    occupied_beds,
    (total_beds - occupied_beds) AS available_beds,
    ROUND((occupied_beds / total_beds) * 100, 1) AS occupancy_pct
FROM wards
ORDER BY occupancy_pct DESC;

-- All current medications for a patient (replace 1 with patient_id)
SELECT
    m.drug_name,
    m.dosage,
    m.route,
    m.frequency,
    m.start_date,
    m.end_date,
    d.full_name AS prescribed_by
FROM medications m
LEFT JOIN doctors d ON m.prescribed_by = d.doctor_id
WHERE m.patient_id = 1
ORDER BY m.start_date DESC;

-- Doctor workload (how many admitted patients per doctor)
SELECT
    d.full_name,
    d.specialization,
    COUNT(p.patient_id) AS active_patients
FROM doctors d
LEFT JOIN patients p ON p.doctor_id = d.doctor_id AND p.status = 'admitted'
GROUP BY d.doctor_id
ORDER BY active_patients DESC;

-- Drop all tables (for reset — careful!)
-- SET FOREIGN_KEY_CHECKS = 0;
-- DROP TABLE IF EXISTS medications, patients, doctors, wards, users;
-- SET FOREIGN_KEY_CHECKS = 1;
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.8+
- MySQL 8.x
- pip

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/mhmdaman/medicore.git
cd medicore

# 2. Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt
```

### `requirements.txt`

```
Flask==3.0.0
mysql-connector-python==8.3.0
bcrypt==4.1.2
python-dotenv==1.0.1
```

### Environment Setup

Create a `.env` file in the project root:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=medicore
SECRET_KEY=your_flask_secret_key
PORT=8000
```

### Run the App

```bash
# Set up the database first
mysql -u root -p < schema.sql

# Start Flask
python app.py
```

App will be live at **http://localhost:8000**

---

## 🔒 Security Notes

- Passwords are hashed with **bcrypt** — never store plaintext.
- Use `.env` for all credentials — never hardcode.
- Add Flask-Login or JWT for session management in production.
- Sanitize all inputs to prevent SQL injection (use parameterized queries, not string concatenation).

---

## 📊 ER Diagram (Chen Notation Summary)

```
[USERS] ──has──> [DOCTORS]
                    │
              assigned-to
                    │
[WARDS] <──── [PATIENTS] ──── prescribes ──── [MEDICATIONS]
```

All tables are in **3rd Normal Form (3NF)**:
- No partial dependencies (2NF ✅)
- No transitive dependencies (3NF ✅)

---



---

> MediCore is a student mini-project. Not intended for production medical use without proper compliance review.
