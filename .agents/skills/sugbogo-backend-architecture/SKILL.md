---
name: sugbogo-backend-architecture
description: Implement or review SugboGo Django backend work using the repository's established service, API, database, GIS, and testing conventions.
---

# SugboGo Backend Architecture

## Purpose

Keep backend changes consistent with the working SugboGo Django/DRF implementation. This is an evidence-based guide, not a substitute for inspecting the affected feature.

## When to use this skill

Use for changes or reviews involving `sugbogo_backend` models, serializers, services, API views, URLs, migrations, permissions, tests, shared backend helpers, or geographic data. Do not use it to infer frontend behavior or introduce a new backend design.

## Repository inspection rule

Read `AGENTS.md` first. Before generating or changing code, inspect the nearest active implementation and its tests, then trace the relevant model, serializer, service, view, URL, and shared helper. Preserve established fields, serializers, routes, response shapes, service functions, exceptions, permissions, and query loading; do not invent any of them when repository evidence exists. If comparable code conflicts, follow the closest maintained feature and state the inconsistency rather than declaring a new convention.

## Backend layering conventions

- Apps live under `apps/`; larger domains may split `models/`, `serializers/`, `services/`, `views/`, `utils/`, and feature-specific test folders. Smaller or older apps also use module-level files. Match the touched app's existing layout.
- Put request parsing, serializer validation, authorization declaration, and response construction in views. Put domain operations and query construction in service classes or service modules. Keep serialization in DRF serializers.
- `config/urls.py` owns top-level `/api/` prefixes and app `urls.py` owns feature routes. Preserve existing route names and path style.
- Reuse shared integrations from `apps/shared/services/` and shared API helpers from `core/`; do not duplicate provider or envelope code.

## Models and database conventions

- Existing database models use explicit uppercase, abbreviated field names and primary keys such as `BUSN_ID` or `MAPP_ID`, explicit uppercase `db_table` values, and foreign-key database column names. Continue an existing domain's naming scheme; do not rename it to conventional lowercase Django names.
- Models generally declare their own `<PREFIX>_CREATED_AT` (`auto_now_add=True`) and `<PREFIX>_UPDATED_AT` (`auto_now=True`). No reusable timestamp base model was found.
- Statuses and other closed value sets are commonly nested `models.TextChoices`; reuse the relevant enum and constraints (`UniqueConstraint`, `unique_together`, ordering) instead of duplicating literals.
- Use migrations generated for the owning app, review their dependencies and operations, and never edit an already-applied migration merely to reshape history.

## Django service-layer conventions

- Services commonly expose focused `@staticmethod` methods on a feature service class, use `transaction.atomic` for multi-record state changes, and use `save(update_fields=[..., "<PREFIX>_UPDATED_AT"])` for deliberate partial updates.
- **Never use `get_object_or_404()` in a service.** For required retrieval, preserve any necessary `select_related`, `prefetch_related`, `Prefetch`, annotations, ordering, or locking; call `.get()` in `try`/`except Model.DoesNotExist` and raise the appropriate existing DRF exception with a controlled, feature-specific user-facing message. Use `NotFound` for missing resources and `ValidationError` or `PermissionDenied` for invalid state or access, as the comparable service does.
- Keep external side effects and database work coordinated as existing services do: transactions, locks, and `transaction.on_commit()` are used where the workflow requires them. Do not add them by habit.

## Serializer and API conventions

- Use `serializers.Serializer` for request/input or derived payloads and `ModelSerializer` for model-backed responses; explicit API names commonly map from internal uppercase fields through `source`, serializer fields, or method fields.
- Views are predominantly `APIView`; some merchant flows use function views with DRF decorators. Reuse the nearest style and its authentication, parser, and throttle declarations.
- Protected endpoints declare `IsAuthenticated`; role-bound endpoints also use `HasRole` with existing `User.UserRole` values. Authentication defaults to JWT.
- Successful non-paginated responses normally use `core.responses.success_response(data=..., message=...)`. Paginated lists use `core.pagination.StandardPagination`, whose `data` contains `items` and `pagination`. Do not introduce a different envelope or change a route's established response shape.

## Error and exception conventions

- `core.exceptions.custom_exception_handler` wraps DRF exceptions into `success: false`, `message`, `code`, and, for validation errors, `errors`. Raise DRF exceptions from ordinary services/views so the handler can preserve that contract.
- Use `core.responses.error_response` only where the closest flow already returns an explicit error response. Some authentication services do this, so response-returning services and exception-raising services coexist; do not generalize either pattern outside its local API contract.
- Preserve explicit error messages and codes that callers/tests already assert.

## Query and performance conventions

- Build list/detail querysets in services. Eager-load exactly the relations consumed by serializers with `select_related`, `prefetch_related`, and custom `Prefetch`; use annotations and explicit ordering where existing results depend on them.
- When changing retrieval, retain the complete optimized queryset before `.get()`, `.first()`, pagination, or serialization. Avoid adding N+1 queries through serializer method fields.

## PostGIS and geographic conventions

- Django GIS is installed and location records use `django.contrib.gis` fields such as `PointField` and `MultiPolygonField` with `srid=4326`. Construct points as `Point(x=longitude, y=latitude, srid=4326)` and keep latitude/longitude conversion at the serializer/service boundary.
- Spatial queries use GIS lookups such as `__contains`. Preserve SRID, field type, and spatial-query semantics; verify the configured database engine/environment supports a spatial migration before adding one.

## Documentation and commenting conventions

- Add a concise one-sentence docstring to every production function and method.

Example:

```python
def reverse_geocode(latitude, longitude):
    """Resolves geographic coordinates into structured business address details."""
```

- Add inline comments only for non-obvious business rules, transformations, external API differences, geographic logic, query behavior, or complex algorithm steps.

Example:

```python
# Google may identify the barangay using different
# sublocality component types.
if (
    "sublocality_level_1" in types
    or "sublocality_level_2" in types
    or "sublocality" in types
):
    address["barangay"] = value
```

- Keep comments concise and focused on purpose, not obvious implementation details.

## Formatting conventions

- Prefer readable multi-line formatting for serializer fields, function calls, ORM queries, response construction, decorators with arguments, and other expressions with multiple arguments.

Example:

```python
name = serializers.CharField(
    source="full_name",
    read_only=True,
)
```

## Testing conventions

- Tests use Django `TestCase` and DRF `APITestCase`, descriptive `test_<behavior>` names, focused service/view test modules, and shared setup/assertion mixins where available (notably `core.tests.assertions.APIResponseAssertionsMixin`).
- The repository has both app-level `tests.py` and nested `tests/`, `services/tests/`, or `views/tests/` layouts. Follow the closest active feature instead of moving tests solely for consistency.
- Assert observable response envelopes, messages/codes where contractual, permissions, validation, and database effects. Do not run unrelated full-suite tests for documentation-only work.

## Migration and change-safety conventions

- Inspect current models, migrations, serializers, services, views, URLs, and representative tests before making a backend change. Make only the smallest coordinated change that preserves existing API and persistence contracts.
- Review migrations and the repository diff; run targeted checks/tests proportionate to changed behavior. Preserve unrelated working-tree changes.

## Final checklist before completing backend work

- [ ] Read `AGENTS.md` and inspected comparable active code and tests.
- [ ] Preserved existing model names, fields, enums, relations, timestamps, serializers, routes, permissions, response envelope, and error contract.
- [ ] Kept service retrieval out of `get_object_or_404()` and retained optimized querysets.
- [ ] Used the existing DRF exception type and controlled message for the comparable condition.
- [ ] Verified GIS SRID and longitude/latitude ordering when geographic data changed.
- [ ] Reviewed generated migrations and ran targeted validation appropriate to the change.
- [ ] Added concise docstrings and only necessary comments to new or modified production code.