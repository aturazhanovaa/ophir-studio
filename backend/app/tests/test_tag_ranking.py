from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.models import (
    Base,
    ContentItem,
    ContentItemTag,
    ContentStatus,
    KnowledgeBaseArea,
    Tag,
    TagCategory,
)
from app.services.drafting import rank_sources, resolve_filter_tags


def _setup_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(engine)
    session = TestingSession()

    sector = TagCategory(key="sector", name="Sector")
    use_case = TagCategory(key="use_case", name="Use Case")
    session.add_all([sector, use_case])
    session.commit()

    hospitality = Tag(category_id=sector.id, key="hospitality", label="Hospitality")
    onboarding = Tag(category_id=use_case.id, key="onboarding", label="Onboarding")
    session.add_all([hospitality, onboarding])
    session.commit()

    area = KnowledgeBaseArea(key="case-studies", name="Case Studies", description="Proof")
    session.add(area)
    session.commit()

    match_item = ContentItem(
        area_id=area.id,
        title="Hospitality VR onboarding",
        body="ROI lift of 32% for hospitality onboarding.",
        status=ContentStatus.APPROVED.value,
        language="en",
    )
    off_item = ContentItem(
        area_id=area.id,
        title="Retail overview",
        body="General retail info.",
        status=ContentStatus.DRAFT.value,
        language="en",
    )
    session.add_all([match_item, off_item])
    session.commit()

    match_item.tags = [
        ContentItemTag(tag_id=hospitality.id),
        ContentItemTag(tag_id=onboarding.id),
    ]
    off_item.tags = [ContentItemTag(tag_id=onboarding.id)]
    session.commit()
    return engine, session, hospitality, onboarding


def test_rank_sources_prioritizes_sector_use_case_match():
    engine, session, hospitality, onboarding = _setup_db()
    try:
        tag_filters, _ = resolve_filter_tags(
            session, {"sector": [hospitality.id], "use_case": [onboarding.id]}
        )
        ranked = rank_sources(session, "outreach email", "Need onboarding copy", tag_filters, "en", limit=2)
        assert ranked[0]["title"] == "Hospitality VR onboarding"
        assert ranked[0]["score"] >= ranked[1]["score"]
    finally:
        session.close()
        engine.dispose()
