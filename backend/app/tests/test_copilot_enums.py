import unittest
from pydantic import ValidationError

from app.schemas.copilot import CopilotAskIn
from app.db.models import AccuracyLevel


class CopilotEnumValidationTests(unittest.TestCase):
    def test_invalid_accuracy_rejected(self):
        with self.assertRaises(ValidationError):
            CopilotAskIn.model_validate(
                {"question": "Test question", "area_id": 1, "accuracy_level": "unsupported", "answer_tone": "TECHNICAL"}
            )

    def test_invalid_tone_rejected(self):
        with self.assertRaises(ValidationError):
            CopilotAskIn.model_validate(
                {"question": "Test question", "area_id": 1, "accuracy_level": "MEDIUM", "answer_tone": "playful"}
            )

    def test_defaults_applied(self):
        obj = CopilotAskIn.model_validate({"question": "Hello", "area_id": 2})
        self.assertEqual(obj.accuracy_level, AccuracyLevel.MEDIUM)
        self.assertIsNotNone(obj.area_ids)

    def test_legacy_values_mapped(self):
        obj = CopilotAskIn.model_validate(
            {"question": "Hello", "area_id": 2, "accuracy_level": "HIGH", "answer_tone": "C_EXECUTIVE"}
        )
        self.assertEqual(obj.accuracy_level, AccuracyLevel.HIGH)
        self.assertEqual(obj.answer_tone.value, "C_EXECUTIVE")


if __name__ == "__main__":
    unittest.main()
