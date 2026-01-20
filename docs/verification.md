# Verification Checklist

Use this checklist to confirm areas, tags, normalization, filtering, and retrieval behavior.

Optional internal page:
- `/admin/verify` shows live checks, behavior test buttons, and curl examples.

## 1) UI check (fast)

Top-level areas
- Go to the Knowledge Base or Areas UI
- Confirm these 4 appear:
  - Industries / Verticals
  - Services / Solutions
  - Outreach & Sales Enablement
  - Case Studies & Proof
PASS: You can create content inside each.

Tags (taxonomy)
- Open Create/Edit content item
- Confirm separate tag fields exist:
  - Sector
  - Use case
  - Audience
  - Funnel stage
  - Geography
PASS: Multi-select (funnel stage can be single) and chosen from existing options.

## 2) API check (most reliable)

Areas
```sh
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/kb/areas
```
PASS: Response includes the 4 areas listed above.

Tag categories
```sh
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/tags/categories
```
PASS: Categories include:
- sector
- use_case
- audience
- funnel_stage
- geography

## 3) Database check

Confirm normalized tables/collections exist:
- areas
- content_items
- tag_categories
- tags
- content_item_tags
PASS: Tags are normalized (not stored as a single string column).

## 4) Behavior check

Filter behavior
- On content list page:
  - sector = Retail AND use_case = Loss prevention
PASS: Results show only matching items.

Retrieval priority
- In AI playground:
  - Select sector + use_case and generate output
PASS if:
  - Uses approved sources for that sector/use_case
  - Warns when sector/use_case is missing.
