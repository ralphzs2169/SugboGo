# SugboGo

SugboGo is a full-stack web application built with **Django**, **Django REST Framework**, **PostgreSQL**, and **React**.

> **Current Status:** Backend setup completed. React frontend is in development.

---

# Tech Stack

## Backend

- Python 3.14+
- Django 6
- Django REST Framework
- PostgreSQL
- psycopg
- python-dotenv

## Frontend

- React 19
- Vite
- JavaScript (ES6+)
- Axios
- React Router
- Tailwind CSS

---

# Project Folder Structure

> **Note:** This structure is not final and will continue to evolve as new features are added.

```text
SugboGo/
│
├── sugbogo_backend/                 # Django backend
│   ├── apps/                        # Feature-based Django applications
│   │   ├── authentication/          # User authentication (login, logout, registration)
│   │   ├── users/                   # Custom user model and user-related features
│   │   ├── admin_operations/        # Admin and Super Admin functionality
│   │   └── merchant_operations/     # Merchant management features
│   │
│   ├── config/                      # Django project configuration (settings, URLs, ASGI/WSGI)
│   ├── manage.py                    # Django management entry point
│   ├── requirements.txt             # Python dependencies
│   └── .env                         # Local environment variables (not committed)
│
├── sugbogo_frontend/
│   └── web_app/                     # React application
│       ├── public/                  # Static assets served directly
│       ├── src/                     # React source code
│       │   ├── assets/              # Images, fonts, and other assets
│       │   ├── components/          # Reusable UI components
│       │   ├── pages/               # Route-level pages
│       │   └── services/            # API clients and backend communication
│       └── .gitignore               # Frontend-specific Git ignore rules
│
├── .gitignore                       # Git ignore rules for the repository
└── README.md                        # Project documentation and setup guide
```

---

# Prerequisites

Install the following before setting up the project:

- Python 3.14+
- PostgreSQL
- pgAdmin 4
- Node.js 22+
- npm
- Git

> **Optional:** DBeaver for database management.

---

# Backend Setup

## 1. Clone the Repository

```bash
git clone <repository-url>
cd SugboGo
```

---

## 2. Create a Virtual Environment

Navigate to the backend.

```bash
cd sugbogo_backend
```

Create the virtual environment.

```bash
python -m venv .venv
```

### Activate the Virtual Environment

**PowerShell**

```powershell
.venv\Scripts\Activate.ps1
```

**Command Prompt**

```cmd
.venv\Scripts\activate.bat
```

---

## 3. Install Dependencies

```bash
python -m pip install -r requirements.txt
```

---

## 4. Create the Environment File

Inside:

```text
sugbogo_backend/
```

Create a file named:

```text
.env
```

Example:

```env
SECRET_KEY=<ask the repository owner>
DEBUG=True

DB_NAME=sugbogo_db
DB_USER=postgres
DB_PASSWORD=your_postgresql_password
DB_HOST=localhost
DB_PORT=5432
```

Replace the database credentials with your own PostgreSQL configuration.

---

## 5. Create the PostgreSQL Database

### Step 1 – Open pgAdmin

Launch **pgAdmin 4**.

If prompted, enter the master password.

---

### Step 2 – Connect to PostgreSQL

Expand:

```text
Servers
└── PostgreSQL
```

Enter your PostgreSQL password if prompted.

---

### Step 3 – Create a Database

Expand:

```text
Servers
└── PostgreSQL
    └── Databases
```

Right-click **Databases**.

Select:

```text
Create
└── Database...
```

Enter:

| Field | Value |
|-------|-------|
| Database Name | `sugbogo_db` |
| Owner | `postgres` |

Click **Save**.

---

### Step 4 – Verify the `.env` File

```env
DB_NAME=sugbogo_db
DB_USER=postgres
DB_PASSWORD=your_postgresql_password
DB_HOST=localhost
DB_PORT=5432
```

---

## 6. Apply Migrations

```bash
python manage.py migrate
```

This creates all required database tables.

---

## 7. Create a Superuser

```bash
python manage.py createsuperuser
```

Follow the prompts.

> **Note:** When typing your password, nothing will appear on the screen. This is normal.

---

## 8. Run the Development Server

```bash
python manage.py runserver
```

Backend:

```text
http://127.0.0.1:8000/
```

---

# Frontend Setup

## 1. Navigate to the Frontend

```bash
cd sugbogo_frontend/web_app
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Start the Development Server

```bash
npm run dev
```

Frontend:

```text
http://localhost:5173/
```

---

# Running the Project

Open **two terminals**.

## Terminal 1 — Backend

```bash
cd sugbogo_backend
python manage.py runserver
```

## Terminal 2 — Frontend

```bash
cd sugbogo_frontend/web_app
npm install   # First time only
npm run dev
```

---

# Updating Dependencies

Whenever you install new Python packages, regenerate `requirements.txt`.

```bash
python -m pip freeze > requirements.txt
```

After pulling new backend changes from GitHub, install any new dependencies.

```bash
python -m pip install -r requirements.txt
```

Similarly, after pulling frontend changes that modify `package.json`, install the updated Node.js dependencies.

```bash
npm install
```

---

# License

This project is intended for educational and development purposes.