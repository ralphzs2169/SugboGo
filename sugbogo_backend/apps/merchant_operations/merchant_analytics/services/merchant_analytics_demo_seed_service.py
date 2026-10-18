"""Coordinate explicitly targeted, resumable local analytics fixtures without user workflows."""

import os
import re
from contextlib import contextmanager
from datetime import UTC, timedelta
from pathlib import Path
from urllib.parse import urlsplit

from django.apps import apps
from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.admin_operations.system_configuration.services import DiscoveryAlgorithmConfigurationService
from apps.business.models import Business, BusinessPocket, BusinessSpecialtyTag, BusinessVouch
from apps.business.services.visibility_event_service import VisibilityEventService, VisibilityEventType
from apps.reviews.models import Review, ReviewReply
from apps.shared.analytics.policy import current_policy, policy_scope
from apps.users.models import User

from ..entitlements import merchant_has_plus_access
from .analytics_demo_dataset import DATASET_VERSION, build_dataset, parse_timestamp
from .analytics_demo_manifest import AnalyticsDemoManifest, row_snapshot
from .analytics_demo_visibility import AnalyticsDemoVisibility


LOCAL_HOSTS = {"", "localhost", "127.0.0.1", "::1"}
OWNED_MODELS = (User, Review, ReviewReply, BusinessPocket, BusinessVouch)


class MerchantAnalyticsDemoSeedService:
    """Keep environment checks, write-ahead ownership and conservative cleanup together."""

    @staticmethod
    def environment(
        *,
        apply,
        confirm_postgres_database,
        confirm_mongodb_database,
        workers_stopped,
        allow_remote_development_mongodb=False,
    ):
        """Require explicit hosted-development authorization while rejecting unsafe database targets."""
        if not settings.DEBUG or connection.vendor != "postgresql":
            raise PermissionDenied(
                "Analytics demo requires DEBUG=True and a local PostgreSQL development database.",
            )
        parameters = connection.get_connection_params()
        postgres_name = str(parameters.get("dbname", ""))
        postgres_host = str(parameters.get("host", ""))
        try:
            mongo = urlsplit(settings.MONGODB_URI or "")
            local_mongo = (
                mongo.scheme == "mongodb"
                and mongo.hostname in LOCAL_HOSTS - {""}
                and "," not in mongo.netloc
            )
            mongo_host = mongo.hostname
            if (
                mongo.scheme not in {"mongodb", "mongodb+srv"}
                or not mongo_host
                or "," in mongo.netloc
                or (mongo.scheme == "mongodb+srv" and mongo.port is not None)
            ):
                raise ValueError("Unsupported MongoDB endpoint")
            if mongo.scheme == "mongodb+srv":
                mongo_port = None
            else:
                mongo_port = mongo.port or 27017
        except ValueError:
            raise PermissionDenied(
                "MongoDB must use a valid single-host mongodb:// or mongodb+srv:// endpoint.",
            ) from None
        mongo_name = settings.MONGODB_DATABASE
        if (
            postgres_host not in LOCAL_HOSTS
            or parameters.get("hostaddr", "") not in LOCAL_HOSTS
            or os.environ.get("PGHOSTADDR", "") not in LOCAL_HOSTS
            or parameters.get("service")
            or os.environ.get("PGSERVICE")
        ):
            raise PermissionDenied(
                "Analytics demo requires local PostgreSQL without remote host addresses or service aliases.",
            )
        if not local_mongo and (
            not allow_remote_development_mongodb
            or confirm_mongodb_database != mongo_name
        ):
            raise PermissionDenied(
                "Hosted development MongoDB requires --allow-remote-development-mongodb "
                "and --confirm-mongodb-database matching the configured development database, "
                "including for dry runs.",
            )
        for name in (postgres_name, mongo_name):
            if (
                not isinstance(name, str)
                or not name
                or name.lower() in {"postgres", "template0", "template1", "admin", "config", "local"}
                or re.search(r"(^|[_-])(prod|production)([_-]|$)", name, re.IGNORECASE)
            ):
                raise PermissionDenied(
                    "Analytics demo refuses system or production database names.",
                )
        if settings.TIME_ZONE != "UTC":
            raise PermissionDenied(
                "The existing visibility UTC-day contract requires TIME_ZONE=UTC.",
            )
        if apply and (
            os.environ.get("SUGBOGO_ANALYTICS_DEMO_ALLOW") != "local-development"
            or confirm_postgres_database != postgres_name
            or confirm_mongodb_database != mongo_name
            or not workers_stopped
        ):
            raise PermissionDenied(
                "Writes require SUGBOGO_ANALYTICS_DEMO_ALLOW=local-development, exact database confirmations, "
                "and --confirm-background-workers-stopped."
            )
        identity = {
            "postgres": {
                "host": postgres_host,
                "port": str(parameters.get("port", "")),
                "database": postgres_name,
            },
            "mongodb": {
                "host": mongo_host,
                "port": mongo_port,
                "database": mongo_name,
            },
        }
        # Keep existing local journals compatible while binding hosted journals
        # to the URI scheme as well as their seed hostname and database name.
        if not local_mongo:
            identity["mongodb"]["scheme"] = mongo.scheme
        return identity

    @staticmethod
    def target(
        business_id,
        *,
        cleanup=False,
        lock=False,
    ):
        """Retrieve exactly the selected business and validate its current owner for insertion."""
        if type(business_id) is not int or business_id <= 0:
            raise ValidationError("Provide one positive --business-id.")
        try:
            query = Business.objects.select_related("USER_ID", "CTGRY_ID")
            if lock:
                query = query.select_for_update()
            business = query.get(pk=business_id)
        except Business.DoesNotExist:
            raise NotFound("The explicitly selected business does not exist.") from None
        if not cleanup and (
            business.BUSN_STATUS != Business.BusinessStatus.ACTIVE
            or business.USER_ID.USER_ROLE != User.UserRole.MERCHANT
            or not business.USER_ID.is_active
        ):
            raise ValidationError(
                "The selected business needs an active merchant owner and active business status.",
            )
        if (
            timezone.is_naive(business.BUSN_CREATED_AT)
            or business.BUSN_CREATED_AT > timezone.now()
        ):
            raise ValidationError(
                "The business creation timestamp must be aware and not in the future.",
            )
        return business

    @staticmethod
    def context(business):
        """Capture immutable eligibility boundaries without taking ownership of real business fields."""
        links = BusinessSpecialtyTag.objects.filter(
            BUSN_ID=business,
            BST_IS_ACTIVE=True,
        ).order_by("TAG_ID")
        return {
            "business_id": business.pk,
            "owner_id": business.USER_ID_id,
            "category_id": business.CTGRY_ID_id,
            "created_at": business.BUSN_CREATED_AT.astimezone(UTC).isoformat(),
            "specialties": [
                {
                    "link_id": link.pk,
                    "tag_id": link.TAG_ID_id,
                    "created_at": link.BST_CREATED_AT.astimezone(UTC).isoformat(),
                    "activated_at": (
                        link.BST_ACTIVATED_AT or link.BST_CREATED_AT
                    ).astimezone(UTC).isoformat(),
                }
                for link in links
            ],
        }

    @staticmethod
    @contextmanager
    def business_lock(business_id):
        """Serialize seed/cleanup sessions and let PostgreSQL release the lock after a crashed process."""
        key = f"merchant-analytics-demo:{business_id}:v{DATASET_VERSION}"
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_try_advisory_lock(hashtextextended(%s, 0))", [key])
            acquired = cursor.fetchone()[0]
        if not acquired:
            raise ValidationError("Another analytics demo operation is running for this business.")
        try:
            yield
        finally:
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_unlock(hashtextextended(%s, 0))", [key])

    @staticmethod
    def quantities(plan):
        """Describe planned fixture contributions independently of any real existing activity."""
        return {
            "explorers": len(plan["actors"]),
            "reviews": len(plan["reviews"]),
            "replies": len(plan["replies"]),
            "pockets": len(plan["pockets"]),
            "vouches": len(plan["vouches"]),
            **{
                kind: sum(row["type"] == kind for row in plan["events"])
                for kind in ("IMPRESSION", "PROFILE_VISIT", "SAVE")
            },
        }

    @staticmethod
    def email(
        plan,
        actor,
    ):
        """Reserve an unusable-password explorer identity unique to this business and dataset version."""
        return f"{plan['namespace']}-e{actor:02d}@sugbogo.invalid"

    @classmethod
    def verify_rows(
        cls,
        data,
        *,
        allow_missing=False,
    ):
        """Reject altered rows, reused primary keys and unexpected model labels before any mutation."""
        result = []
        labels = {model._meta.label_lower for model in OWNED_MODELS}
        for expected in data["rows"]:
            if expected["model"] not in labels:
                raise ValidationError("The manifest contains an unsupported owned model.")
            model = apps.get_model(expected["model"])
            record = model.objects.filter(pk=expected["id"]).first()
            if record is None:
                if allow_missing:
                    continue
                raise ValidationError(
                    "A seed-owned SQL record is missing; refusing to recreate or claim it.",
                )
            if row_snapshot(record)["fingerprint"] != expected["fingerprint"]:
                raise ValidationError(
                    "A seed-owned SQL record was edited; refusing to overwrite or delete it.",
                )
            result.append(record)
        return result

    @staticmethod
    def verify_references(
        records,
        data,
    ):
        """Prevent cascades or nulling of any relationship not owned by this signed execution."""
        owned = {}
        for row in data["rows"]:
            owned.setdefault(row["model"], set()).add(row["id"])
        for model in OWNED_MODELS:
            ids = owned.get(model._meta.label_lower, set())
            if not ids:
                continue
            for relation in model._meta.related_objects:
                related = relation.related_model
                references = related._default_manager.filter(
                    **{f"{relation.field.name}__in": ids},
                )
                permitted = owned.get(related._meta.label_lower, set())
                if references.exclude(pk__in=permitted).exists():
                    raise ValidationError(
                        "Seed records have unrelated dependent records; cleanup would cascade or alter real data.",
                    )
        for record in records:
            if isinstance(record, User):
                for field in User._meta.many_to_many:
                    if getattr(record, field.name).exists():
                        raise ValidationError(
                            "A demo account gained permission/group relationships; refusing cleanup.",
                        )

    @staticmethod
    def create_record(
        model,
        fields,
        created_field,
        timestamp,
    ):
        """Validate a new fixture then backdate only its own auto-created timestamp."""
        record = model(**fields)
        if isinstance(record, User):
            record.set_unusable_password()
        record.full_clean()
        record.save()
        model.objects.filter(pk=record.pk).update(**{created_field: timestamp})
        record.refresh_from_db()
        return record

    @classmethod
    def create_sql(
        cls,
        data,
        journal,
    ):
        """Journal all inserted row fingerprints before committing one relational transaction."""
        plan = data["plan"]
        business_id = data["context"]["business_id"]
        rows = []
        actors = {}
        reviews = {}
        with transaction.atomic():
            business = cls.target(business_id, lock=True)
            list(
                BusinessSpecialtyTag.objects.select_for_update().filter(
                    BUSN_ID=business,
                ),
            )
            if cls.context(business) != data["context"]:
                raise ValidationError(
                    "Business ownership or specialty eligibility changed; rerun the dry run.",
                )
            for actor in plan["actors"]:
                record = cls.create_record(
                    User,
                    {
                        "USER_EMAIL": cls.email(plan, actor),
                        "USER_FNAME": "Analytics DEMO",
                        "USER_LNAME": f"Explorer {actor:02d}",
                        "USER_ROLE": User.UserRole.EXPLORER,
                        "USER_STATUS": User.UserStatus.ACTIVE,
                        "USER_REPUTATION": plan["baseline"],
                    },
                    "USER_CREATED_AT",
                    parse_timestamp(plan["anchor"]) - timedelta(days=100),
                )
                actors[actor] = record.pk
                rows.append({"key": f"actor:{actor}", **row_snapshot(record)})
            for item in plan["reviews"]:
                record = cls.create_record(
                    Review,
                    {
                        "BUSN_ID_id": business_id,
                        "USER_ID_id": actors[item["actor"]],
                        "REVW_TEXT": item["text"],
                        "REVW_STATUS": Review.ReviewStatus.PUBLISHED,
                        "REVW_SENTIMENT_LABEL": item["sentiment"],
                        "REVW_SENTIMENT_SCORE": item["score"],
                        "REVW_SHOW_IN_COMMUNITY": False,
                    },
                    "REVW_CREATED_AT",
                    parse_timestamp(item["at"]),
                )
                reviews[item["key"]] = record.pk
                rows.append({"key": item["key"], **row_snapshot(record)})
            for item in plan["replies"]:
                record = cls.create_record(
                    ReviewReply,
                    {
                        "REVW_ID_id": reviews[item["review"]],
                        "RPLY_TEXT": item["text"],
                    },
                    "RPLY_CREATED_AT",
                    parse_timestamp(item["at"]),
                )
                rows.append({"key": f"reply:{item['review']}", **row_snapshot(record)})
            for index, item in enumerate(plan["pockets"]):
                record = cls.create_record(
                    BusinessPocket,
                    {
                        "BUSN_ID_id": business_id,
                        "USER_ID_id": actors[item["actor"]],
                    },
                    "PCKT_CREATED_AT",
                    parse_timestamp(item["at"]),
                )
                rows.append({"key": f"pocket:{index}", **row_snapshot(record)})
            for index, item in enumerate(plan["vouches"]):
                record = cls.create_record(
                    BusinessVouch,
                    {
                        "BUSN_ID_id": business_id,
                        "USER_ID_id": actors[item["actor"]],
                        "TAG_ID_id": item["tag_id"],
                        "VOUCH_REPUTATION_SNAPSHOT": plan["baseline"],
                        "VOUCH_EVIDENCE_IS_VALID": True,
                    },
                    "VOUCH_CREATED_AT",
                    parse_timestamp(item["at"]),
                )
                rows.append({"key": f"vouch:{index}", **row_snapshot(record)})
            # A crash after commit but before the next file write can be resolved
            # by verifying these exact rows; a rollback leaves all of them absent.
            data["rows"] = rows
            data["phase"] = "sql_commit_intent"
            journal.write(data)
        data["phase"] = "sql_ready"
        journal.write(data)

    @staticmethod
    def actors(data):
        """Restore the reserved actor mapping from authenticated SQL row identities."""
        return {
            int(row["key"].split(":")[1]): row["id"]
            for row in data["rows"]
            if row["key"].startswith("actor:")
        }

    @classmethod
    def documents(
        cls,
        data,
    ):
        """Build the exact existing visibility document shape from the persisted plan."""
        actors = cls.actors(data)
        if not data["rows"]:
            return []
        business_id = data["context"]["business_id"]
        result = []
        for item in data["plan"]["events"]:
            stamp = parse_timestamp(item["at"])
            actor = actors[item["actor"]]
            if actor == data["context"]["owner_id"]:
                raise ValidationError("A seed explorer cannot be the selected business owner.")
            key = VisibilityEventService._build_dedupe_key(
                VisibilityEventType(item["type"]),
                actor,
                business_id,
                VisibilityEventService._get_event_day(stamp),
            )
            result.append({
                "event_type": item["type"],
                "business_id": business_id,
                "explorer_id": actor,
                "occurred_at": stamp,
                "dedupe_key": key,
            })
        return result

    @classmethod
    def resume_sql(
        cls,
        data,
        journal,
    ):
        """Resolve the all-or-nothing relational commit before attempting MongoDB writes."""
        if data["phase"] == "sql_commit_intent":
            present = cls.verify_rows(data, allow_missing=True)
            if present and len(present) != len(data["rows"]):
                raise ValidationError(
                    "Only part of the journaled SQL transaction exists; manual investigation is required.",
                )
            if present:
                data["phase"] = "sql_ready"
            else:
                data["rows"] = []
                data["phase"] = "planned"
            journal.write(data)
        if data["phase"] == "planned":
            emails = [
                cls.email(data["plan"], actor)
                for actor in data["plan"]["actors"]
            ]
            if User.objects.filter(USER_EMAIL__in=emails).exists():
                raise ValidationError(
                    "Reserved demo emails already exist without committed manifest ownership.",
                )
            cls.create_sql(data, journal)
        cls.verify_rows(data)

    @classmethod
    def cleanup(
        cls,
        data,
        journal,
        visibility,
    ):
        """Remove exact observations before transactionally deleting unedited fixture rows."""
        records = cls.verify_rows(
            data,
            allow_missing=data["phase"] in {"cleanup", "cleaned"},
        )
        cls.verify_references(records, data)
        actors = list(cls.actors(data).values())
        documents = cls.documents(data)
        visibility.verify(documents, actors)
        data["phase"] = "cleanup"
        journal.write(data)
        deleted = visibility.cleanup(documents, actors)
        with transaction.atomic():
            cls.target(data["context"]["business_id"], cleanup=True, lock=True)
            records = cls.verify_rows(data, allow_missing=True)
            cls.verify_references(records, data)
            for model in (ReviewReply, Review, BusinessVouch, BusinessPocket, User):
                ids = [
                    row["id"]
                    for row in data["rows"]
                    if row["model"] == model._meta.label_lower
                ]
                model.objects.filter(pk__in=ids).delete()
        data["phase"] = "cleaned"
        receipt = journal.archive(data)
        return {"state": "cleaned", "mongo_deleted_this_run": deleted, "receipt": receipt}

    @classmethod
    def run(
        cls,
        *,
        business_id,
        apply=False,
        cleanup=False,
        confirm_cleanup=None,
        confirm_postgres_database=None,
        confirm_mongodb_database=None,
        workers_stopped=False,
        manifest_directory=None,
        allow_remote_development_mongodb=False,
    ):
        """Inspect by default and mutate only a named, authorized local-development target."""
        identity = cls.environment(
            apply=apply,
            confirm_postgres_database=confirm_postgres_database,
            confirm_mongodb_database=confirm_mongodb_database,
            workers_stopped=workers_stopped,
            allow_remote_development_mongodb=allow_remote_development_mongodb,
        )
        if cleanup and apply and confirm_cleanup != business_id:
            raise PermissionDenied("Cleanup requires --confirm-cleanup matching --business-id.")
        directory = manifest_directory or Path(settings.BASE_DIR) / ".analytics-demo"
        journal = AnalyticsDemoManifest(directory, business_id)
        if apply:
            with cls.business_lock(business_id):
                return cls.execute(
                    business_id,
                    cleanup,
                    journal,
                    identity,
                    apply=True,
                )
        return cls.execute(
            business_id,
            cleanup,
            journal,
            identity,
            apply=False,
        )

    @classmethod
    def execute(
        cls,
        business_id,
        cleanup,
        journal,
        identity,
        *,
        apply,
    ):
        """Revalidate a signed plan and report exact contributions and skipped scope."""
        business = cls.target(business_id, cleanup=cleanup)
        context = cls.context(business)
        data = journal.read()
        if cleanup and data is None:
            return {"state": "nothing_to_clean", "business_id": business_id}
        if data is not None and (
            data.get("version") != DATASET_VERSION
            or data.get("identity") != identity
            or data.get("context", {}).get("business_id") != business_id
        ):
            raise ValidationError(
                "The manifest belongs to another version, database environment or business.",
            )
        with policy_scope():
            policy = current_policy()
            configuration = DiscoveryAlgorithmConfigurationService.require_complete_reputation_configuration()
        if data is None:
            anchor = timezone.now().astimezone(UTC).replace(microsecond=0)
            data = {
                "version": DATASET_VERSION,
                "identity": identity,
                "context": context,
                "phase": "planned",
                "rows": [],
                "plan": build_dataset(context, anchor, configuration.DAC_REPUTATION_BASELINE),
                "counter_adjustments": {},
            }
        elif not cleanup and data["context"] != context:
            raise ValidationError(
                "Target ownership, lifetime or specialties changed since this plan was created.",
            )
        if not cleanup and data["phase"] == "planned":
            emails = [
                cls.email(data["plan"], actor)
                for actor in data["plan"]["actors"]
            ]
            if User.objects.filter(USER_EMAIL__in=emails).exists():
                raise ValidationError(
                    "Reserved demo emails already exist without committed manifest ownership.",
                )
        visibility = AnalyticsDemoVisibility()
        inventory = {
            "reviews": Review.objects.filter(BUSN_ID=business).count(),
            "replies": ReviewReply.objects.filter(REVW_ID__BUSN_ID=business).count(),
            "pockets": BusinessPocket.objects.filter(BUSN_ID=business).count(),
            "vouches": BusinessVouch.objects.filter(BUSN_ID=business).count(),
            "visibility": visibility.inspect(business_id),
        }
        quantities = cls.quantities(data["plan"])
        result = {
            "state": "dry_run_cleanup" if cleanup else "dry_run",
            "business_id": business_id,
            "business_name": business.BUSN_NAME,
            "business_status": business.BUSN_STATUS,
            "owner_id": business.USER_ID_id,
            "database_environment": identity,
            "business_created_at": context["created_at"],
            "active_specialties": len(context["specialties"]),
            "inventory": inventory,
            "planned_contribution": quantities,
            "anchor": data["plan"]["anchor"],
            "policy_version": policy.version,
            "policy": dict(policy.values),
            "plus_access": merchant_has_plus_access(business.USER_ID),
            "manifest": str(journal.path),
            "manifest_phase": data["phase"],
            "skipped": [
                "No peers, stored summaries, recommendation jobs or new event types are created.",
                "All existing counters, business fields and discovery scores remain unchanged.",
                "Activity before business/specialty eligibility is omitted; at most three active specialties are used.",
            ],
        }
        if not apply:
            if data["rows"]:
                records = cls.verify_rows(
                    data,
                    allow_missing=data["phase"] in {"cleanup", "sql_commit_intent", "cleaned"},
                )
                if cleanup:
                    cls.verify_references(records, data)
                visibility.verify(cls.documents(data), list(cls.actors(data).values()))
            return result
        if cleanup:
            if not journal.path.exists():
                raise ValidationError("Cleanup requires an existing signed execution manifest.")
            if data["phase"] == "sql_commit_intent":
                present = cls.verify_rows(data, allow_missing=True)
                if not present:
                    data["rows"] = []
            result.update(cls.cleanup(data, journal, visibility))
            return result
        if data["phase"] in {"cleanup", "cleaned"}:
            raise ValidationError("Finish the interrupted cleanup before applying a new dataset.")
        if not data["plan"]["actors"]:
            raise ValidationError(
                "There are no elapsed eligible fixture slots; no records were written.",
            )
        if not journal.path.exists():
            journal.write(data)
        cls.resume_sql(data, journal)
        data["phase"] = "mongo_writing"
        journal.write(data)
        inserted = visibility.apply(cls.documents(data), list(cls.actors(data).values()))
        data["phase"] = "complete"
        journal.write(data)
        result.update({
            "state": "complete",
            "manifest_phase": "complete",
            "seeded_contribution": quantities,
            "verified_sql_records": len(data["rows"]),
            "mongo_inserted_this_run": inserted,
        })
        return result
