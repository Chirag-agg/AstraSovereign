"""Unit tests for the deterministic TaskRouter."""

from app.services.task_router import TaskRouter


def _router():
    return TaskRouter()


def test_general_question_classified_general():
    result = _router().classify("Explain what a refinery heat exchanger does.")
    assert result.task_type == "general"
    assert result.reason


def test_coding_request_classified_coding():
    result = _router().classify("write Python code to sort a list")
    assert result.task_type == "coding"
    assert result.reason == "Programming intent detected"


def test_debugging_request_classified_coding():
    result = _router().classify("debug this JavaScript error")
    assert result.task_type == "coding"


def test_sql_query_classified_coding():
    result = _router().classify("create a SQL query that joins two tables")
    assert result.task_type == "coding"


def test_code_block_classified_coding():
    result = _router().classify("```python\nprint('hello')\n```")
    assert result.task_type == "coding"


def test_fix_function_classified_coding():
    result = _router().classify("fix this function so it returns early")
    assert result.task_type == "coding"


def test_document_request_classified_document():
    result = _router().classify("summarize this document for me")
    assert result.task_type == "document"


def test_pdf_request_classified_document():
    result = _router().classify("extract the tables from this pdf")
    assert result.task_type == "document"


def test_vision_request_classified_vision():
    result = _router().classify("describe what is in this image")
    assert result.task_type == "vision"


def test_empty_message_classified_general():
    result = _router().classify("")
    assert result.task_type == "general"
