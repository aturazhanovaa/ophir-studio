from typing import Iterable, List, Set

from app.db.models import Tag

REQUIRED_TAG_CATEGORY_KEYS: Set[str] = {
    "sector",
    "use_case",
    "audience",
    "funnel_stage",
    "geography",
}

OPTIONAL_TAG_CATEGORY_KEYS: Set[str] = {
    "persona",
    "industry_subvertical",
    "product_line",
    "compliance",
    "price_tier",
}

ALLOWED_TAG_CATEGORY_KEYS: Set[str] = REQUIRED_TAG_CATEGORY_KEYS | OPTIONAL_TAG_CATEGORY_KEYS
SINGLE_SELECT_CATEGORY_KEYS: Set[str] = {"funnel_stage"}


class TagValidationError(ValueError):
    pass


def validate_content_item_tags(tags: Iterable[Tag]) -> None:
    category_keys: List[str] = []
    for tag in tags:
        if not tag.category:
            raise TagValidationError("Tags must belong to a category.")
        category_keys.append(tag.category.key)

    invalid = sorted({key for key in category_keys if key not in ALLOWED_TAG_CATEGORY_KEYS})
    if invalid:
        raise TagValidationError(f"Invalid tag category for content items: {', '.join(invalid)}.")

    for key in SINGLE_SELECT_CATEGORY_KEYS:
        if category_keys.count(key) > 1:
            raise TagValidationError(f"Only one '{key}' tag is allowed.")
