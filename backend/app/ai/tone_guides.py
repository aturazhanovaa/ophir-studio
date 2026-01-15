from dataclasses import asdict, dataclass
from typing import Dict, List, Optional

from app.db.models import AnswerTone


@dataclass
class ToneFormatting:
    headings: List[str]
    key_takeaway_label: str
    next_steps_label: str
    max_bullets: int
    max_sentences: int
    sentence_length: str


@dataclass
class ToneGuide:
    id: str
    name: str
    description: str
    reference_summary: str
    rules: List[str]
    formatting: ToneFormatting
    template: str
    preview: str

    def to_public(self) -> Dict:
        data = asdict(self)
        return data


TONE_GUIDES: Dict[AnswerTone, ToneGuide] = {
    AnswerTone.TECHNICAL: ToneGuide(
        id=AnswerTone.TECHNICAL.value,
        name="Technical",
        description="Structured engineering response with steps, constraints, and edge cases.",
        reference_summary=(
            "Based on engineering design docs and runbooks: lead with the direct answer, provide numbered steps, "
            "call out constraints/dependencies, and list edge cases before execution."
        ),
        rules=[
            "Start with a one-sentence direct answer to the question.",
            "Use numbered steps with verbs; keep each bullet to one idea.",
            "State constraints, dependencies, and inputs explicitly.",
            "List edge cases and failure modes before the next action.",
            "Use precise, technical vocabulary; avoid marketing language.",
        ],
        formatting=ToneFormatting(
            headings=["Summary", "Steps", "Constraints", "Edge cases", "Key takeaway", "Next steps"],
            key_takeaway_label="Key takeaway",
            next_steps_label="Next steps",
            max_bullets=6,
            max_sentences=8,
            sentence_length="short, imperative clauses",
        ),
        template=(
            "Summary: <1 sentence answer>\n"
            "Steps:\n- Step 1\n- Step 2\n"
            "Constraints:\n- Constraint / dependency\n"
            "Edge cases:\n- Edge or risk\n"
            "Key takeaway: <one line>\n"
            "Next steps:\n- Owner / when"
        ),
        preview="Direct, numbered, and explicit about constraints and edge cases.",
    ),
    AnswerTone.C_EXECUTIVE: ToneGuide(
        id=AnswerTone.C_EXECUTIVE.value,
        name="C-Executive",
        description="Boardroom brief: outcome first, why it matters, single next step.",
        reference_summary=(
            "Patterned after consulting-style exec briefs (McKinsey/BCG): outcome or decision in the first line, "
            "three bullets max tied to KPIs/ROI, jargon-free, and a clear next step with owner."
        ),
        rules=[
            "Lead with the outcome/decision in one sentence.",
            "Use up to three bullets; each must tie to KPI, ROI, risk, or timeline.",
            "Avoid jargon and acronyms unless necessary; spell them once if used.",
            "Highlight the decision needed or confirm if no decision is required.",
            "Finish with one recommended next step and an owner/time horizon.",
        ],
        formatting=ToneFormatting(
            headings=["Outcome", "Why it matters", "Next step"],
            key_takeaway_label="Outcome",
            next_steps_label="Next step",
            max_bullets=3,
            max_sentences=5,
            sentence_length="crisp, executive-ready lines",
        ),
        template=(
            "Outcome: <one sentence>\n"
            "Why it matters:\n- Impact/KPI\n- Risk/ROI\n"
            "Next step:\n- Owner / by when"
        ),
        preview="Outcome-first, KPI-tied, three bullets max, one next step.",
    ),
    AnswerTone.COLLOQUIAL: ToneGuide(
        id=AnswerTone.COLLOQUIAL.value,
        name="Colloquial",
        description="Friendly, plain-language explanation with short sentences.",
        reference_summary=(
            "Informed by support-style help content: simple words, short sentences, approachable tone, and clear actions "
            "people can follow without domain jargon."
        ),
        rules=[
            "Speak in short, friendly sentences (10-14 words).",
            "Use simple words and define any unavoidable jargon in-line.",
            "Give a quick answer up front, then 2-4 bullets the user can follow.",
            "Offer one tip or caution if it helps avoid mistakes.",
            "Close with an encouraging next step.",
        ],
        formatting=ToneFormatting(
            headings=["Quick answer", "How to do it", "Watch out for", "Next steps"],
            key_takeaway_label="Quick answer",
            next_steps_label="Next steps",
            max_bullets=4,
            max_sentences=7,
            sentence_length="short, warm sentences",
        ),
        template=(
            "Quick answer: <one friendly sentence>\n"
            "How to do it:\n- Step 1\n- Step 2\n"
            "Watch out for:\n- Common pitfall\n"
            "Next steps:\n- Easy action to try"
        ),
        preview="Friendly and clear; short sentences with a gentle next step.",
    ),
}


_ITALIAN_HEADINGS: Dict[AnswerTone, Dict[str, str]] = {
    AnswerTone.COLLOQUIAL: {
        "Quick answer": "Risposta rapida",
        "How to do it": "Come fare",
        "Watch out for": "Attenzione",
        "Next steps": "Prossimi passi",
    },
    AnswerTone.TECHNICAL: {
        "Summary": "Sintesi",
        "Steps": "Passi",
        "Constraints": "Vincoli",
        "Edge cases": "Casi limite",
        "Key takeaway": "Messaggio chiave",
        "Next steps": "Prossimi passi",
    },
    AnswerTone.C_EXECUTIVE: {
        "Outcome": "Risultato",
        "Why it matters": "Perché conta",
        "Next step": "Prossimo passo",
    },
}


def _localize_guide_to_it(guide: ToneGuide, tone: AnswerTone) -> ToneGuide:
    mapping = _ITALIAN_HEADINGS.get(tone, {})
    if not mapping:
        return guide

    fmt = guide.formatting
    localized_headings = [mapping.get(h, h) for h in fmt.headings]
    key_label = mapping.get(fmt.key_takeaway_label, fmt.key_takeaway_label)
    next_label = mapping.get(fmt.next_steps_label, fmt.next_steps_label)

    template = guide.template
    # Replace only the section labels (e.g., "Quick answer:" -> "Risposta rapida:")
    for en, it in mapping.items():
        template = template.replace(f"{en}:", f"{it}:")

    localized_fmt = ToneFormatting(
        headings=localized_headings,
        key_takeaway_label=key_label,
        next_steps_label=next_label,
        max_bullets=fmt.max_bullets,
        max_sentences=fmt.max_sentences,
        sentence_length=fmt.sentence_length,
    )

    return ToneGuide(
        id=guide.id,
        name=guide.name,
        description=guide.description,
        reference_summary=guide.reference_summary,
        rules=guide.rules,
        formatting=localized_fmt,
        template=template,
        preview=guide.preview,
    )


def get_tone_guide(tone: AnswerTone, locale: Optional[str] = None) -> ToneGuide:
    guide = TONE_GUIDES.get(tone) or TONE_GUIDES[AnswerTone.TECHNICAL]
    if (locale or "").lower().startswith("it"):
        return _localize_guide_to_it(guide, tone)
    return guide


def list_tone_guides() -> List[Dict]:
    return [guide.to_public() for guide in TONE_GUIDES.values()]
