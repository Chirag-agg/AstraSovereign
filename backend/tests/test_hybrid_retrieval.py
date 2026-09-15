"""Hybrid retrieval: per-page cap, BM25 exact tokens, chunk headers."""

import asyncio

from app.schemas.document import ChunkRecord
from app.services.knowledge_base import _chunk_header
from app.services.vector_store import JsonVectorStore


def run(coro):
    return asyncio.run(coro)


def chunk(chunk_id, doc_id, filename, page, text, vector):
    return ChunkRecord(
        chunk_id=chunk_id,
        document_id=doc_id,
        user_id="u",
        filename=filename,
        page=page,
        text=text,
        vector=vector,
    )


def test_at_most_two_chunks_per_document_page(tmp_path):
    store = JsonVectorStore(str(tmp_path / "vs"))
    chunks = [
        chunk(f"c{i}", "d1", "f.pdf", 1, f"alpha section {i}", [1.0, 0.0, 0.0])
        for i in range(4)
    ]
    # distinct vectors so near-duplicate suppression does not interfere
    chunks[1].vector = [0.0, 1.0, 0.0]
    chunks[2].vector = [0.0, 0.0, 1.0]
    chunks[3].vector = [0.5, 0.5, 0.0]
    run(store.upsert_chunks("u", chunks))
    results = run(
        store.search_hybrid(
            "u", "alpha", [1.0, 0.0, 0.0], top_k=4, per_page_cap=2, duplicate_threshold=1.0
        )
    )
    same_page = [r for r in results if r.document_id == "d1" and r.page == 1]
    assert len(same_page) <= 2


def test_bm25_surfaces_exact_token_dense_ranks_out(tmp_path):
    store = JsonVectorStore(str(tmp_path / "vs"))
    run(
        store.upsert_chunks(
            "u",
            [
                chunk("a", "d1", "f.pdf", 1, "the pump inspection notes", [1.0, 0.0]),
                chunk("b", "d2", "g.pdf", 2, "PSV-204A calibration record", [0.0, 1.0]),
            ],
        )
    )
    dense = run(store.search("u", [1.0, 0.0], 1))
    assert dense[0].chunk_id == "a"  # dense alone misses the exact-token chunk
    hybrid = run(store.search_hybrid("u", "PSV-204A", [1.0, 0.0], top_k=2))
    assert any(result.chunk_id == "b" for result in hybrid)


def test_chunk_header_carries_document_revision_page():
    assert _chunk_header("SOP-09_Rev3.pdf", 12) == "[SOP-09_Rev3.pdf | Rev 3 | p.12]"
    assert _chunk_header("notes.txt", None) == "[notes.txt]"
