"""Durable per-user extraction artifacts (one JSON file per document).

Kept separate from the vector store: the artifact is the structured extraction
(elements + markdown), not the index. Ownership is enforced by path scoping, so
``read_document`` can only ever load the caller's own artifact.
"""

import logging
import re
from pathlib import Path
from typing import Optional

from app.schemas.extraction import DocumentExtraction

logger = logging.getLogger("app.extraction_store")

_SAFE = re.compile(r"[^A-Za-z0-9_.-]")


def _safe(component: str) -> str:
    return _SAFE.sub("_", component or "")


class JsonExtractionStore:
    """Writes ``<root>/<user>/<document_id>.json`` atomically."""

    def __init__(self, root) -> None:
        self._root = Path(root)

    def _path(self, user_id: str, document_id: str) -> Path:
        return self._root / _safe(user_id) / f"{_safe(document_id)}.json"

    def put(self, user_id: str, extraction: DocumentExtraction) -> None:
        path = self._path(user_id, extraction.document_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".json.tmp")
        tmp.write_text(extraction.model_dump_json(indent=2), encoding="utf-8")
        tmp.replace(path)

    def get(self, user_id: str, document_id: str) -> Optional[DocumentExtraction]:
        path = self._path(user_id, document_id)
        if not path.exists():
            return None
        try:
            return DocumentExtraction.model_validate_json(
                path.read_text(encoding="utf-8")
            )
        except Exception:
            logger.exception(
                "extraction_read_error",
                extra={
                    "event": "extraction_read_error",
                    "user_id": user_id,
                    "document_id": document_id,
                },
            )
            return None

    def delete(self, user_id: str, document_id: str) -> None:
        path = self._path(user_id, document_id)
        try:
            path.unlink()
        except FileNotFoundError:
            pass
