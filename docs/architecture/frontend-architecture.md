# Frontend Architecture

## Overview

SugboGo follows a feature-based architecture to keep related code together and
make the project easier to maintain as new features are added.

Each feature owns its own:

- Screens
- Components
- Hooks
- Services
- API types
- Utilities

Shared functionality lives under `shared/`.

---

# Project Structure

```text
src/
│
├── app/
├── features/
├── shared/
├── assets/
├── constants/
└── types/
```

---

# Feature Structure

```text
features/
└── auth/
    ├── api/
    ├── components/
    ├── hooks/
    ├── screens/
    ├── store/
    ├── utils/
    └── types/
```

Each feature should be self-contained.

---

# Layer Responsibilities

<img src="/docs/tables/frontend-layer-responsibility.png" alt="Frontend Request Flow" width="700">

---

# Request Flow

<img src="/docs/diagrams/frontend-request-flow.png" alt="Frontend Request Flow" width="700">

---

# Authentication Flow

<img src="/docs/diagrams/auth-flow.png" alt="Authentication Flow" width="700">



---

# Error Handling

Errors are handled at different layers.

## Screen

Responsible for:

- Loading states
- Validation
- Error messages
- Navigation

## Hook

Responsible for:

- Updating Zustand
- Feature logic

## Service

Responsible for:

- Calling endpoints

No UI logic.

## request()

Responsible for:

- Returning a standardized ApiResponse.

Never throws Axios errors.

## apiClient

Responsible for:

- JWT
- Refresh token
- Retry requests
- Redirect after session expiration

---

# Authentication State

Global authentication state is stored in Zustand.

```text
user
isAuthenticated
isLoading
isSigningIn
sessionExpired
```

---

# API Response Format

Every service returns:

```ts
{
    success: boolean;
    message: string;
    code: string;
    data?: ...
}
```

No service should expose Axios responses.

---

# Rules

## Screens

✅ Can

- Show Toasts
- Navigate
- Validate Forms

❌ Cannot

- Call Axios directly

---

## Hooks

✅ Can

- Update Zustand
- Combine API calls

❌ Cannot

- Show UI

---

## Services

✅ Can

- Call backend

❌ Cannot

- Update Zustand
- Navigate
- Show Toasts

---

## request()

✅ Can

- Normalize errors

❌ Cannot

- Navigate
- Show UI

---

## apiClient

✅ Can

- Attach tokens
- Refresh tokens
- Retry requests

❌ Cannot

- Display UI