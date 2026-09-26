import unittest
import os
import tempfile
import importlib

TEST_DB = os.path.join(tempfile.gettempdir(), "casecompass-test.db")
os.environ["CASECOMPASS_DB_PATH"] = TEST_DB
os.environ["GEMINI_API_KEY"] = ""
import main


class CaseCompassApiTests(unittest.TestCase):
    def setUp(self):
        main.db_cases.clear()
        with main.sqlite3.connect(main.DB_PATH) as connection:
            connection.execute("DELETE FROM cases")

    def test_case_creation_and_generation_fallbacks(self):
        case = main.create_case(main.CaseCreate(
            description="A contractor missed the agreed completion date.",
            parties_involved="Homeowner and contractor",
            objective="Prepare for a consultation",
        ))
        case_id = case["id"]
        self.assertEqual(main.get_case(case_id)["status"], "New")

        questions = main.lawyer_questions(case_id)
        self.assertGreaterEqual(len(questions["questions"]), 3)

        answer = main.ask_case_question(case_id, main.QuestionRequest(question="What deadline matters?"))
        self.assertIn("answer", answer)

        brief = main.generate_brief(case_id)
        self.assertIn("Case Brief", brief["brief"])

    def test_empty_question_is_rejected(self):
        case = main.create_case(main.CaseCreate(description="A short case description."))
        with self.assertRaises(Exception):
            main.ask_case_question(case["id"], main.QuestionRequest(question="   "))

    def test_case_survives_module_reload(self):
        case = main.create_case(main.CaseCreate(description="Persist this case."))
        case_id = case["id"]
        importlib.reload(main)
        self.assertEqual(main.get_case(case_id)["description"], "Persist this case.")

    def test_question_retrieves_relevant_uploaded_passage(self):
        case = main.create_case(main.CaseCreate(description="A contract dispute."))
        main.db_cases[case["id"]]["_text_chunks"] = [
            {"document": "contract.txt", "text": "The payment deadline was 30 June 2026."},
            {"document": "email.txt", "text": "The parties discussed delivery timing."},
        ]
        answer = main.ask_case_question(case["id"], main.QuestionRequest(question="What was the payment deadline?"))
        self.assertIn("contract.txt", answer["sources"])

    def test_text_extraction_and_chunking(self):
        self.assertEqual(main._extract_text("notes.txt", b"hello world"), "hello world")
        chunks = main._chunk_text("A" * 1500, size=400, overlap=50)
        self.assertGreater(len(chunks), 3)


if __name__ == "__main__":
    unittest.main()
