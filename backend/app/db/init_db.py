from sqlalchemy import inspect, text
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session
from app.db.models import (
    Base,
    User,
    Area,
    AreaMembership,
    UserAreaAccess,
    KnowledgeBaseArea,
    ContentItem,
    ContentItemTag,
    TagCategory,
    Tag,
    Role,
    Document,
    DocumentVersion,
    Chunk,
    AccessGrantSource,
    AccuracyLevel,
    AnswerTone,
    ContentStatus,
)
from app.db.session import engine
from app.core.security import hash_password

DEFAULT_AREAS = [
    ("marketing", "Marketing", "#1d4ed8"),   # blue
    ("sales", "Sales", "#16a34a"),           # green
    ("technical", "Technical", "#7c3aed"),   # purple
    ("rnd", "R&D", "#f97316"),               # orange
    ("startups", "Startups", "#0f766e"),     # teal
    ("onboarding", "Onboarding", "#f59e0b"), # amber
]

DEFAULT_KB_AREAS = [
    ("industries", "Industries / Verticals", "Sector-specific positioning and insights."),
    ("services", "Services / Solutions", "Offerings, packages, and solution narratives."),
    ("outreach", "Outreach & Sales Enablement", "Approved outreach, talk tracks, and enablement."),
    ("case-studies", "Case Studies & Proof", "Proof points, metrics, and ROI evidence."),
]

DEFAULT_TAG_CATEGORIES = [
    ("sector", "Sector", "Primary industry sector."),
    ("use_case", "Use Case", "Business or product use case."),
    ("audience", "Audience", "Target decision-maker or persona."),
    ("funnel_stage", "Funnel Stage", "Lifecycle stage in the buying journey."),
    ("geography", "Geography", "Region or market."),
    ("persona", "Persona", "Optional persona descriptor."),
    ("industry_subvertical", "Industry Subvertical", "Optional subvertical."),
    ("product_line", "Product Line", "Optional product line."),
    ("compliance", "Compliance", "Optional compliance context."),
    ("price_tier", "Price Tier", "Optional pricing tier."),
]

DEFAULT_TAGS = [
    ("sector", "hospitality", "Hospitality"),
    ("sector", "retail", "Retail"),
    ("sector", "healthcare", "Healthcare"),
    ("sector", "manufacturing", "Manufacturing"),
    ("use_case", "vr-training-safety", "VR training safety"),
    ("use_case", "onboarding", "Onboarding"),
    ("use_case", "customer-demo", "Customer demo"),
    ("use_case", "events", "Events"),
    ("use_case", "loss-prevention", "Loss prevention"),
    ("audience", "ceo", "CEO"),
    ("audience", "hr", "HR"),
    ("audience", "lnd", "L&D"),
    ("audience", "operations", "Operations"),
    ("funnel_stage", "awareness", "Awareness"),
    ("funnel_stage", "consideration", "Consideration"),
    ("funnel_stage", "decision", "Decision"),
    ("funnel_stage", "retention", "Retention"),
    ("geography", "eu", "EU"),
    ("geography", "mena", "MENA"),
    ("geography", "it", "IT"),
]

def init_db(db: Session):
    _sync_columns()
    Base.metadata.create_all(bind=engine)

    # Seed areas
    existing = {a.key: a for a in db.query(Area).all()}
    for key, name, color in DEFAULT_AREAS:
        area = existing.get(key)
        if not area:
            db.add(Area(key=key, name=name, color=color))
        else:
            if not area.color:
                area.color = color
                db.add(area)
    db.commit()

    # Backfill any areas without a color (e.g., custom areas)
    default_color = "#4b5563"  # neutral fallback
    for area in db.query(Area).filter(Area.color.is_(None)).all():
        area.color = default_color
        db.add(area)
    db.commit()

    _seed_kb_areas(db)
    _seed_tag_taxonomy(db)

    _seed_users_and_memberships(db)
    _seed_verification_samples(db)
    _backfill_versions(db)


def _sync_columns():
    insp = inspect(engine)

    def add_column(table: str, column_sql: str):
        # Skip if the table hasn't been created yet (fresh install) to avoid NoSuchTableError.
        if not insp.has_table(table):
            return
        col_name = column_sql.split()[0]
        cols = {c["name"] for c in insp.get_columns(table)}
        if col_name not in cols:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column_sql}"))

    add_column("users", "role VARCHAR(32) NOT NULL DEFAULT 'USER'")

    add_column("documents", "deleted_at DATETIME")
    add_column("documents", "tags TEXT NOT NULL DEFAULT '[]'")
    add_column("documents", "latest_version INTEGER NOT NULL DEFAULT 1")
    add_column("documents", "latest_version_id INTEGER")

    add_column("chunks", "version_id INTEGER")
    add_column("chunks", "page INTEGER")
    add_column("chunks", "section VARCHAR(255)")
    add_column("chunks", "is_latest BOOLEAN NOT NULL DEFAULT 1")
    add_column("access_requests", "decided_by_user_id INTEGER")
    add_column("access_requests", "decided_at DATETIME")
    add_column("access_requests", "decision_reason TEXT")
    add_column("access_requests", "message TEXT")
    add_column("analytics_events", f"accuracy_level VARCHAR(32) NOT NULL DEFAULT '{AccuracyLevel.MEDIUM.value}'")
    add_column("analytics_events", f"answer_tone VARCHAR(32) NOT NULL DEFAULT '{AnswerTone.C_EXECUTIVE.value}'")
    add_column("analytics_events", "tokens_in INTEGER")
    add_column("analytics_events", "tokens_out INTEGER")
    add_column("analytics_events", "latency_ms INTEGER")
    add_column("areas", "color VARCHAR(16)")
    add_column("conversations", "workspace_id INTEGER NOT NULL DEFAULT 1")
    add_column("conversation_messages", "meta JSON")

    _migrate_analytics_enums(insp)
    _backfill_conversation_meta(insp)


def _backfill_conversation_meta(insp):
    if not insp.has_table("conversation_messages"):
        return
    cols = {c["name"] for c in insp.get_columns("conversation_messages")}
    if "metadata" in cols and "meta" in cols:
        with engine.begin() as conn:
            conn.execute(text("UPDATE conversation_messages SET meta = metadata WHERE meta IS NULL"))


def _migrate_analytics_enums(insp):
    if not insp.has_table("analytics_events"):
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE analytics_events SET accuracy_level = :high "
                "WHERE accuracy_level IN ('HIGH', 'high', 'STRICT', 'strict')"
            ),
            {"high": AccuracyLevel.HIGH.value},
        )
        conn.execute(
            text(
                "UPDATE analytics_events SET accuracy_level = :low "
                "WHERE accuracy_level IN ('LOW', 'low', 'CREATIVE', 'creative')"
            ),
            {"low": AccuracyLevel.LOW.value},
        )
        conn.execute(
            text(
                "UPDATE analytics_events SET accuracy_level = :medium "
                "WHERE accuracy_level IS NULL OR accuracy_level = '' "
                "OR accuracy_level IN ('MEDIUM', 'medium', 'BALANCED', 'balanced')"
            ),
            {"medium": AccuracyLevel.MEDIUM.value},
        )
        conn.execute(
            text(
                "UPDATE analytics_events SET accuracy_level = :medium "
                "WHERE accuracy_level NOT IN (:low, :medium, :high)"
            ),
            {
                "low": AccuracyLevel.LOW.value,
                "medium": AccuracyLevel.MEDIUM.value,
                "high": AccuracyLevel.HIGH.value,
            },
        )

        conn.execute(
            text(
                "UPDATE analytics_events SET answer_tone = :executive "
                "WHERE answer_tone IN ('C_EXECUTIVE', 'EXECUTIVE', 'executive')"
            ),
            {"executive": AnswerTone.C_EXECUTIVE.value},
        )
        conn.execute(
            text(
                "UPDATE analytics_events SET answer_tone = :colloquial "
                "WHERE answer_tone IN ('COLLOQUIAL', 'colloquial')"
            ),
            {"colloquial": AnswerTone.COLLOQUIAL.value},
        )
        conn.execute(
            text(
                "UPDATE analytics_events SET answer_tone = :executive "
                "WHERE answer_tone IS NULL OR answer_tone = '' "
                "OR answer_tone IN ('TECHNICAL', 'technical', 'balanced', 'default')"
            ),
            {"executive": AnswerTone.C_EXECUTIVE.value},
        )
        conn.execute(
            text(
                "UPDATE analytics_events SET answer_tone = :executive "
                "WHERE answer_tone NOT IN (:technical, :executive, :colloquial)"
            ),
            {
                "technical": AnswerTone.TECHNICAL.value,
                "executive": AnswerTone.C_EXECUTIVE.value,
                "colloquial": AnswerTone.COLLOQUIAL.value,
            },
        )


def _seed_kb_areas(db: Session):
    existing = {a.key: a for a in db.query(KnowledgeBaseArea).all()}
    for idx, (key, name, description) in enumerate(DEFAULT_KB_AREAS):
        area = existing.get(key)
        if not area:
            db.add(
                KnowledgeBaseArea(
                    key=key,
                    name=name,
                    description=description,
                    order_index=idx,
                )
            )
        else:
            area.name = name
            if description and not area.description:
                area.description = description
            area.order_index = idx
            db.add(area)
    db.commit()


def _seed_tag_taxonomy(db: Session):
    existing_categories = {c.key: c for c in db.query(TagCategory).all()}
    for key, name, description in DEFAULT_TAG_CATEGORIES:
        cat = existing_categories.get(key)
        if not cat:
            cat = TagCategory(key=key, name=name, description=description)
            db.add(cat)
            db.flush()
        else:
            cat.name = name
            if description and not cat.description:
                cat.description = description
            db.add(cat)
        existing_categories[key] = cat

    db.commit()

    existing_tags = {
        (t.category.key if t.category else None, t.key): t for t in db.query(Tag).join(TagCategory).all()
    }
    for category_key, tag_key, label in DEFAULT_TAGS:
        cat = existing_categories.get(category_key)
        if not cat:
            continue
        tag = existing_tags.get((category_key, tag_key))
        if not tag:
            db.add(Tag(category_id=cat.id, key=tag_key, label=label, deprecated=False))
        else:
            tag.label = label
            db.add(tag)
    db.commit()


def _seed_users_and_memberships(db: Session):
    # Promote legacy admin if present
    admin = db.query(User).filter(User.email == "admin@studio.local").first()
    if admin:
        admin.role = Role.ADMIN.value
        admin.is_admin = True
        db.add(admin)
    else:
        admin = User(
            email="admin@studio.local",
            full_name="Studio Admin",
            password_hash=hash_password("Admin123!"),
            role=Role.ADMIN.value,
            is_admin=True,
        )
        db.add(admin)

    super_admin = db.query(User).filter(User.email == "superadmin@studio.local").first()
    if not super_admin:
        super_admin = User(
            email="superadmin@studio.local",
            full_name="Super Admin",
            password_hash=hash_password("Super123!"),
            role=Role.SUPER_ADMIN.value,
            is_admin=True,
        )
        db.add(super_admin)

    marketing_user = db.query(User).filter(User.email == "marketing@studio.local").first()
    if not marketing_user:
        marketing_user = User(
            email="marketing@studio.local",
            full_name="Marketing Lead",
            password_hash=hash_password("Marketing123!"),
            role=Role.USER.value,
        )
        db.add(marketing_user)

    sales_user = db.query(User).filter(User.email == "sales@studio.local").first()
    if not sales_user:
        sales_user = User(
            email="sales@studio.local",
            full_name="Sales Lead",
            password_hash=hash_password("Sales123!"),
            role=Role.USER.value,
        )
        db.add(sales_user)

    db.commit()

    def ensure_access(user_id: int, area_key: str, source: AccessGrantSource):
        area = db.query(Area).filter(Area.key == area_key).first()
        if not area:
            return

        insert_fn = pg_insert if engine.dialect.name == "postgresql" else sqlite_insert
        stmt = insert_fn(UserAreaAccess).values(
            user_id=user_id,
            area_id=area.id,
            granted_by_user_id=None,
            source=source.value,
        ).on_conflict_do_nothing(index_elements=["user_id", "area_id"])
        db.execute(stmt)

        # Maintain legacy membership flags for compatibility with existing permissions
        m = (
            db.query(AreaMembership)
            .filter(AreaMembership.user_id == user_id, AreaMembership.area_id == area.id)
            .first()
        )
        if not m:
            m = AreaMembership(user_id=user_id, area_id=area.id)
            db.add(m)
        m.can_read = True
        m.can_write = True
        m.can_manage = True

    # Backfill any legacy area_memberships into user_area_access
    for membership in db.query(AreaMembership).all():
        area = db.query(Area).filter(Area.id == membership.area_id).first()
        if not area:
            continue
        ensure_access(membership.user_id, area.key, AccessGrantSource.SEED)

    areas = db.query(Area).all()
    area_ids = [a.id for a in areas]

    # Super admin: access to all areas
    if super_admin:
        for aid in area_ids:
            area = db.get(Area, aid)
            if area:
                ensure_access(super_admin.id, area.key, AccessGrantSource.SEED)

    if admin:
        for aid in area_ids:
            area = db.get(Area, aid)
            if area:
                ensure_access(admin.id, area.key, AccessGrantSource.SEED)

    if marketing_user:
        ensure_access(marketing_user.id, "marketing", AccessGrantSource.SEED)
    if sales_user:
        ensure_access(sales_user.id, "sales", AccessGrantSource.SEED)

    db.commit()


def _seed_verification_samples(db: Session):
    area = db.query(KnowledgeBaseArea).filter(KnowledgeBaseArea.key == "case-studies").first()
    if not area:
        return

    tags = (
        db.query(Tag)
        .join(TagCategory)
        .filter(TagCategory.key.in_(["sector", "use_case"]))
        .all()
    )
    tag_map = {(t.category.key if t.category else None, t.key): t for t in tags}
    retail = tag_map.get(("sector", "retail"))
    loss_prevention = tag_map.get(("use_case", "loss-prevention"))
    if not retail or not loss_prevention:
        return

    existing = db.query(ContentItem).filter(ContentItem.title == "Retail loss prevention proof").first()
    tag_ids = sorted({retail.id, loss_prevention.id})
    if not existing:
        item = ContentItem(
            area_id=area.id,
            title="Retail loss prevention proof",
            summary="Shrink reduction and operational ROI from targeted retail loss prevention.",
            body="Retail teams reduced shrink by 18% using targeted loss prevention workflows.",
            status=ContentStatus.APPROVED.value,
            language="en",
            owner_name="Seed",
            metrics="Shrink reduction 18%, audit time reduced 25%.",
        )
        item.tags = [ContentItemTag(tag_id=tag_id) for tag_id in tag_ids]
        db.add(item)
    else:
        existing.status = ContentStatus.APPROVED.value
        existing.owner_name = existing.owner_name or "Seed"
        db.query(ContentItemTag).filter(ContentItemTag.content_item_id == existing.id).delete(
            synchronize_session=False
        )
        db.flush()
        existing.tags = [ContentItemTag(tag_id=tag_id) for tag_id in tag_ids]
        db.add(existing)
    db.commit()


def _backfill_versions(db: Session):
    docs = db.query(Document).all()
    for doc in docs:
        if not doc.tags:
            doc.tags = "[]"
        # if no version rows, create one from legacy filename
        if not doc.versions:
            dv = DocumentVersion(
                document_id=doc.id,
                version=doc.latest_version or 1,
                file_path=doc.filename,
                original_name=doc.original_name,
                mime_type=doc.mime_type,
                created_by=doc.created_by,
            )
            db.add(dv)
            db.flush()
            doc.latest_version_id = dv.id
            doc.latest_version = dv.version
        else:
            # ensure latest_version_id is set
            latest = sorted(doc.versions, key=lambda v: v.version)[-1]
            doc.latest_version_id = latest.id
            doc.latest_version = latest.version

        for chunk in doc.chunks:
            if chunk.version_id is None:
                chunk.version_id = doc.latest_version_id
            if chunk.is_latest is None:
                chunk.is_latest = True
        db.add(doc)
    db.commit()
