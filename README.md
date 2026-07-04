# SugboGo

SugboGo is a full-stack web application built with **Django**, **Django REST Framework**, **PostgreSQL**, and **React**.

> **Current Status:** Backend setup completed. React frontend is planned.

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

* React (Coming Soon)

---

# Project Structure

```text
SugboGo/
│
├── sugbogo_backend/                 # Django backend
│   ├── apps/                        # Feature-based Django applications
│   │   ├── authentication/          # Login, logout, registration, authentication logic
│   │   ├── users/                   # Custom user model and user-related functionality
│   │   └── merchant_operations/     # Merchant management and business operations
│   │
│   ├── config/                      # Django project configuration (settings, URLs, ASGI/WSGI)
│   ├── manage.py                    # Django management command entry point
│   ├── requirements.txt             # Python project dependencies
│   └── .env                         # Local environment variables (not committed)
│
├── sugbogo_frontend/                # Frontend applications
│   ├── mobile/                      # React Native mobile application
│   └── web_app/                     # React web application
│
├── .gitignore                       # Files and folders ignored by Git
└── README.md                        # Project documentation and setup instructions
```

---

# Prerequisites

Before running the project, install:

* Python 3.14+
* PostgreSQL
* Git

---

# Backend Setup

## 1. Clone the repository

```bash
git clone <repository-url>
cd SugboGo
```

---

## 2. Create a virtual environment

Windows

```bash
cd sugbogo_backend

python -m venv .venv
```

Activate it

PowerShell

```powershell
.venv\Scripts\Activate.ps1
```

Command Prompt

```cmd
.venv\Scripts\activate.bat
```

---

## 3. Install dependencies

```bash
python -m pip install -r requirements.txt
```

---

## 4. Create the environment file

Inside:

```text
sugbogo_backend/
```

Create:

```text
.env
```

Example:

```env

DB_NAME=sugbogo
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
```

Replace the database credentials with your own PostgreSQL configuration.

---

## 5. Create the PostgreSQL database

Create a database named:

```text
sugbogo
```

or update the `.env` file to match the database name you created.

---

## 6. Apply migrations

```bash
python manage.py migrate
```

---

## 7. Create a superuser

```bash
python manage.py createsuperuser
```

Follow the prompts.

> **Note:** When entering the password, nothing will appear on the screen. This is normal behavior.

---

## 8. Run the development server

```bash
python manage.py runserver
```

The backend will be available at:

```text
http://127.0.0.1:8000/
```

---

# Installed Apps

Current applications:

* authentication
* users
* merchant_operations

---

# API Endpoints

Authentication

```text
POST /api/auth/login/
POST /api/auth/register/
POST /api/auth/logout/
```

Users

```text
GET /api/users/me/
GET /api/users/profile/
```

> Additional endpoints will be added as development progresses.

---

# Updating Dependencies

Whenever new Python packages are installed, regenerate the requirements file:

```bash
python -m pip freeze > requirements.txt
```

---

# License

This project is intended for educational and development purposes.
