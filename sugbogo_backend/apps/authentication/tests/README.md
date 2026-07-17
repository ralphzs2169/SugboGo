# Authentication Tests

This directory contains automated tests for the authentication module.

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
