# Authentication Tests

This directory contains automated tests for the authentication module.

## Core-flow verification

`test_core_flows.py` connects registration/verification, password and email
changes, lockout recovery, session rotation/revocation, manual reactivation, and
live permissions through real API endpoints. External delivery is mocked.
Run it with `python manage.py test apps.authentication.tests.test_core_flows`.
See `docs/iam-core-flow-verification.md` in the backend for the coverage matrix,
migration instructions, recorded results, policy limits, and pending live QA.

## Run all authentication tests

```bash
python manage.py test apps.authentication.tests
```

## Run a specific test file

```bash
python manage.py test apps.authentication.tests.test_login
```

## Run a specific test

```bash
python manage.py test apps.authentication.tests.test_login.LoginViewTests.test_login_successfully_returns_tokens
```

## Run tests with coverage

```bash
python -m coverage run manage.py test apps.authentication.tests
```

## View coverage summary

```bash
python -m coverage report
```

## Generate HTML coverage report

```bash
python -m coverage html
```

Open the generated report:

```text
htmlcov/index.html
```

This provides a detailed, line-by-line view of which parts of the authentication module are covered by the test suite.
