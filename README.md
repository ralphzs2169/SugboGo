# SugboGo

SugboGo is a full-stack web application built with *Django*, *Django REST Framework*, *PostgreSQL*, and *React*.

**Current Status:** Backend setup completed. React frontend is planned.


---

# Tech Stack

## Backend

* Python 3.14+
* Django 6
* Django REST Framework
* PostgreSQL
* psycopg
* python-dotenv

## Frontend

* React 19
* Vite
* JavaScript (ES6+)
* Axios
* React Router
* Tailwind CSS

---

# Project Folder Structure 

Not final, constantly updated when new fetures and folders are added

text
SugboGo/
│
├── sugbogo_backend/                 # Django backend
│   ├── apps/                        # Feature-based Django applications
│   │   ├── authentication/          # Login, logout, registration, authentication logic
│   │   ├── users/                   # Custom user model and user-related functionality
│   │   ├── admin_operations/        # Admin & Super Admin functionalities
│   │   └── merchant_operations/     # Merchant management and business operations
│   │
│   ├── config/                      # Django project configuration (settings, URLs, ASGI/WSGI)
│   ├── manage.py                    # Django management command entry point
│   ├── requirements.txt             # Python project dependencies
│   └── .env                         # Local environment variables (not committed)
│
├── sugbogo_frontend/
│    └── web_app/
│        ├── public/                 # Static assets served directly (favicon, icons, etc.)
│        ├── src/                    # React application source code
│        │   ├── assets/             # Images, fonts, and other bundled static assets
│        │   ├── components/         # Reusable UI components
│        │   ├── pages/              # Route-level pages
│        │   └── services/           # API clients and backend communication
│        └──  .gitignore              # Frontend-specific Git ignore rules
│
├── .gitignore                       # Files and folders ignored by Git
└── README.md                        # Project documentation and setup instructions

---

# Prerequisites

Before running the project, install:

* Python 3.14+
* PostgreSQL
* Node.js 22+
* npm
* Git

---

# Backend Setup

## 1. Clone the repository

git clone <repository-url>
cd SugboGo

---

## 2. Create a virtual environment

Windows

cd sugbogo_backend

python -m venv .venv

Activate it

PowerShell

.venv\Scripts\Activate.ps1

Command Prompt

cmd
.venv\Scripts\activate.bat

---

## 3. Install dependencies

python -m pip install -r requirements.txt

---

## 4. Create the environment file

Inside:

text
sugbogo_backend/

Create:

text
.env

Example:

env

SECRET_KEY=? (ask from owner)
DEBUG=True

DB_NAME=sugbogo
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432

Replace the database credentials with your own PostgreSQL configuration.

---

## 5. Create the PostgreSQL Database

### Prerequisites

Before creating the database, make sure you have the following installed:

- **PostgreSQL** (Database Server)
- **pgAdmin 4** (GUI for managing PostgreSQL databases)
- **DBeaver** (Optional database management tool)

> **Note:** Installing only pgAdmin or DBeaver is **not enough**. You must have the PostgreSQL server installed and running.

---

### Step 1: Open pgAdmin

Launch **pgAdmin 4**.

If prompted, enter the master password (if you configured one).

---

### Step 2: Connect to PostgreSQL

1. Expand **Servers**.
2. Select your PostgreSQL server (e.g., **PostgreSQL 17**).
3. Enter the password you created during PostgreSQL installation.

---

### Step 3: Create a New Database

1. Expand:

   ```
   Servers
   └── PostgreSQL
       └── Databases
   ```

2. Right-click **Databases**.

3. Select:

   ```
   Create
   └── Database...
   ```

4. Enter the following:

   **Database Name**

   ```
   sugbogo_db
   ```

5. Leave **Owner** as:

   ```
   postgres
   ```

6. Click **Save**.

Your database is now ready.

---

### Step 4: Update the Environment Variables

Ensure your `.env` file matches the database you created.

```env
DB_NAME=sugbogo_db
DB_USER=postgres
DB_PASSWORD=your_postgresql_password
DB_HOST=localhost
DB_PORT=5432
```

Replace `your_postgresql_password` with the password you set during PostgreSQL installation.

---


## 6. Apply migrations

python manage.py migrate

---

## 7. Create a superuser

python manage.py createsuperuser

Follow the prompts.

**Note:** When entering the password, nothing will appear on the screen. This is normal behavior.


---

## 8. Run the development server

python manage.py runserver

The backend will be available at:

text
http://127.0.0.1:8000/

---

# Frontend Setup

## 1. Navigate to the frontend

cd sugbogo_frontend/web_app

## 2. Install dependencies

npm install

## 3. Start the development server

npm run dev

The frontend will be available at:

text
http://localhost:5173/

# Running the Project

Open two terminals.

### Terminal 1 - Backend

cd sugbogo_backend
python manage.py runserver

### Terminal 2 - Frontend

cd sugbogo_frontend/web_app
npm run dev

---

# Updating Dependencies

Whenever new Python packages are installed, regenerate the requirements file:

python -m pip freeze > requirements.txt

---

# License

This project is intended for educational and development purposes.