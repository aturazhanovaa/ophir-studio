import unittest

from app.db.models import AccuracyLevel, AnswerTone
from app.services.rag import build_prompt_style


class LocaleHeadingTests(unittest.TestCase):
    def test_locale_it_uses_italian_headings(self):
        prompt = build_prompt_style(AccuracyLevel.MEDIUM, AnswerTone.COLLOQUIAL, locale="it")
        self.assertIn("Risposta rapida:", prompt)
        self.assertNotIn("Quick answer:", prompt)


if __name__ == "__main__":
    unittest.main()

