import json
from pathlib import Path

from jsonschema import Draft202012Validator


SCHEMA_PATH = Path(__file__).parents[2] / "specs" / "001-cv-generation-flow" / "contracts" / "cv-schema.json"


def load_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def test_schema_is_valid() -> None:
    Draft202012Validator.check_schema(load_schema())


def test_schema_requires_empty_or_partial_dates() -> None:
    schema = load_schema()
    partial_date = schema["$defs"]["partialDate"]
    assert {"const": ""} in partial_date["anyOf"]
    assert "MM-YYYY" not in json.dumps(partial_date)


def test_schema_defines_http_contact_urls() -> None:
    schema = load_schema()
    contact = schema["properties"]["personalInfo"]["properties"]
    assert contact["linkedin"]["anyOf"][1]["pattern"].startswith("^https?")
    assert contact["website"]["anyOf"][1]["pattern"].startswith("^https?")
