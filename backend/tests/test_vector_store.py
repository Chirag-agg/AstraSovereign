"""Vector store tests: upsert/search, delete, persistence, isolation."""

import asyncio

from app.schemas.document import ChunkRecord, DocumentRecord
from app.services.vector_store import JsonVectorStore
from tests.conftest import FakeEmbeddingProvider


def make_chunk(doc_id, user, index, text, page=None, filename=None):
    vector = asyncio.run(FakeEmbeddingProvider().embed(text))
    return ChunkRecord(
        chunk_id=f"{doc_id}:{index}",
        document_id=doc_id,
        user_id=user,
        filename=filename or f"{doc_id}.txt",
        page=page,
        text=text,
        vector=vector,
    )


def make_doc(doc_id, user, filename):
    return DocumentRecord(document_id=doc_id, user_id=user, filename=filename, document_type="txt", status="ready")


def test_upsert_and_search_ranks_by_relevance(tmp_path):
    store = JsonVectorStore(str(tmp_path))
    embedder = FakeEmbeddingProvider()

    asyncio.run(store.put_document("u1", make_doc("d1", "u1", "pump.txt")))
    asyncio.run(store.put_document("u1", make_doc("d2", "u1", "safety.txt")))
    asyncio.run(store.upsert_chunks("u1", [
        make_chunk("d1", "u1", 0, "cooling water pump must be inspected every 30 days", filename="pump.txt"),
        make_chunk("d2", "u1", 0, "always wear protective gloves when handling chemicals", filename="safety.txt"),
    ]))

    query = asyncio.run(embedder.embed("pump inspection"))
    results = asyncio.run(store.search("u1", query, 2))
    assert results[0].filename == "pump.txt"
    assert results[0].score > 0.0
    assert results[0].document_id == "d1"


def test_delete_document_removes_chunks(tmp_path):
    store = JsonVectorStore(str(tmp_path))
    asyncio.run(store.put_document("u1", make_doc("d1", "u1", "a.txt")))
    asyncio.run(store.upsert_chunks("u1", [
        make_chunk("d1", "u1", 0, "hello world"),
        make_chunk("d1", "u1", 1, "second chunk"),
    ]))
    assert asyncio.run(store.delete_document("u1", "d1")) == 2
    assert asyncio.run(store.list_documents("u1")) == []
    assert asyncio.run(store.search("u1", [1.0] * 64, 5)) == []


def test_persistence_across_restart(tmp_path):
    store1 = JsonVectorStore(str(tmp_path))
    asyncio.run(store1.put_document("u1", make_doc("d1", "u1", "a.txt")))
    asyncio.run(store1.upsert_chunks("u1", [make_chunk("d1", "u1", 0, "persist me")]))

    store2 = JsonVectorStore(str(tmp_path))  # fresh instance, same root
    docs = asyncio.run(store2.list_documents("u1"))
    assert [d.filename for d in docs] == ["a.txt"]
    results = asyncio.run(
        store2.search("u1", asyncio.run(FakeEmbeddingProvider().embed("persist")), 3)
    )
    assert len(results) == 1


def test_cross_user_isolation(tmp_path):
    store = JsonVectorStore(str(tmp_path))
    asyncio.run(store.put_document("user-a", make_doc("secret", "user-a", "confidential.txt")))
    asyncio.run(store.upsert_chunks("user-a", [make_chunk("secret", "user-a", 0, "classified pump data")]))

    assert asyncio.run(store.list_documents("user-b")) == []
    assert asyncio.run(store.get_document("user-b", "secret")) is None
    query = asyncio.run(FakeEmbeddingProvider().embed("pump"))
    assert asyncio.run(store.search("user-b", query, 5)) == []
    # deleting as the wrong user does nothing
    assert asyncio.run(store.delete_document("user-b", "secret")) == 0
    assert asyncio.run(store.get_document("user-a", "secret")) is not None


def test_stats(tmp_path):
    store = JsonVectorStore(str(tmp_path))
    asyncio.run(store.put_document("u1", make_doc("d1", "u1", "a.txt")))
    asyncio.run(store.upsert_chunks("u1", [make_chunk("d1", "u1", 0, "x")]))
    asyncio.run(store.put_document("u2", make_doc("d2", "u2", "b.txt")))
    asyncio.run(store.upsert_chunks("u2", [make_chunk("d2", "u2", 0, "y")]))
    assert store.stats() == {"documents": 2, "chunks": 2}


def test_get_document_metadata(tmp_path):
    store = JsonVectorStore(str(tmp_path))
    asyncio.run(store.put_document("u1", make_doc("d1", "u1", "a.txt")))
    doc = asyncio.run(store.get_document("u1", "d1"))
    assert doc is not None
    assert doc.filename == "a.txt"
