# SugboGo

SugboGo is a tourism platform that promotes hidden gems and Micro, Small, and Medium Enterprises (MSMEs) across Cebu. The platform consists of a Django REST API backend, a React-based administrative web application, and a React Native mobile application.

---

## Repository Structure

```text
SugboGo/
│
├── sugbogo_backend/                 # Django REST API
│   └── README.md                    # Backend setup guide
│
├── sugbogo_frontend/
│   ├── web_app/                     # React + Vite admin web application
│   │   └── README.md                # Web application setup guide
│   │
│   └── mobile/                      # React Native + Expo mobile application
│       └── README.md                # Mobile application setup guide
│
└── README.md                        # Project overview
```

---

## Project Architecture

The SugboGo platform consists of three main applications.

### Backend

Provides the REST API used by both the web and mobile applications.
![Django](https://img.shields.io/badge/Django-6.x-green)
**Technologies**

- Python
- Django
- Django REST Framework
- PostgreSQL
- JWT Authentication

---

### Web Application

Administrative dashboard used to manage users, MSMEs, specialty tags, analytics, and system configuration.

**Technologies**

- React
- Vite
- Tailwind CSS
- React Router
- Axios
- Zustand

---

### Mobile Application

Mobile application that allows users to discover hidden gems and MSMEs, manage their accounts, and access location-based features.

**Technologies**

- React Native
- Expo
- TypeScript
- Expo Router

---

## Prerequisites

Depending on which application you plan to run, you may need:

- Git
- Python 3.11+
- PostgreSQL
- Node.js (LTS recommended)
- npm
- Android Studio (optional, for Android emulator)
- Android device (recommended for mobile testing)

---

## 1.) Clone the Repository

```bash
git clone <repository-url>
```

Navigate to the project directory:

```bash
cd SugboGo
```

---

## 2.) Choose an Application to Set Up

Each application has its own setup guide.

| Application | Setup Guide |
|-------------|-------------|
| Backend | `sugbogo_backend/README.md` |
| Web Application | `sugbogo_frontend/web_app/README.md` |
| Mobile Application | `sugbogo_frontend/mobile/README.md` |

---

## Recommended Setup Order

For first-time setup, configure the applications in the following order:

1. Backend
2. Web Application
3. Mobile Application

The backend must be configured and running before the web or mobile applications can communicate with the API.

---

## Contributors

Developed as part of the **SugboGo** capstone project.