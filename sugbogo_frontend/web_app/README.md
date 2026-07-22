# SugboGo Web Application

The SugboGo web application is built with React and Vite. It provides the administrative interface for managing users, MSMEs, specialty tags, system settings, analytics, and other platform operations.

## Tech Stack

- React
- Vite
- Tailwind CSS
- React Router
- Axios
- Zustand

## Web Application Folder Structure

```text
web_app/
│
├── src/
│   │
│   ├── features/                     # Feature-based application modules
│   │   │
│   │   ├── auth/                     # Authentication feature
│   │   │   ├── api/                  # Authentication API services
│   │   │   ├── assets/               # Authentication images and illustrations
│   │   │   ├── components/           # Authentication UI components
│   │   │   ├── hooks/                # Authentication hooks
│   │   │   ├── pages/                # Authentication pages
│   │   │   ├── routes/               # Protected routes
│   │   │   ├── storage/              # Authentication state management
│   │   │   └── utils/                # Validation and authentication helpers
│   │   │
│   │   └── admin-panel/              # Administrative features
│   │       ├── components/           # Reusable admin UI components
│   │       ├── config/               # Navigation configuration
│   │       ├── constants/            # Shared constants and page metadata
│   │       ├── dashboard/            # Dashboard-specific components
│   │       ├── msme/                 # MSME management components
│   │       ├── pages/                # Admin pages
│   │       └── services/             # Backend API services
│   │
│   ├── shared/                       # Shared resources across features
│   │   ├── api/                      # Axios clients, token handling, API helpers
│   │   ├── components/               # Reusable application components
│   │   ├── hooks/                    # Shared custom hooks
│   │   ├── services/                 # Shared services
│   │   └── utils/                    # Shared utility functions
│   │
│   ├── hooks/                        # Global application hooks
│   │
│   ├── assets/                       # Global images, icons, and logos
│   │
│   ├── App.jsx                       # Root application component
│   ├── main.jsx                      # React application entry point
│   └── index.css                     # Global styles
│
├── public/                           # Static public assets
│
├── package.json                      # Node dependencies and scripts
├── vite.config.js                    # Vite configuration
├── eslint.config.js                  # ESLint configuration
└── README.md                         # Web application setup documentation
```
## Requirements

Before setting up the project, ensure the following are installed:

- Node.js 20 or later
- npm

## 1.) Navigate to the Web Application

From the project root:

```bash
cd sugbogo_frontend/web_app
```

Install the project dependencies:

```bash
npm install
```

## 2.) Configure Environment Variables

Copy the example environment file.

### macOS / Linux

```bash
cp .env.example .env
```

### Windows (PowerShell)

```powershell
Copy-Item .env.example .env
```

Update the required values:

```env
VITE_API_URL=http://localhost:8000/api
```

> **Note**
>
> Ensure the backend server is running before starting the web application.

## 3.) Start the Development Server

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:5173
```

## 4.) Default Administrator Account

During the backend database migration, an initial Super Administrator account is automatically created.

Use the following credentials to sign in to the admin panel:

**Email**

```text
superadmin@gmail.com
```

**Password**

```text
admin1234
```

> **Note**
>
> This account is intended for local development only. Change the password or create additional administrator accounts as needed.