"""SQLite connection layer for the durable job/artifact/audit stores.

Design notes:

- One ``sqlite3.Connection`` per database path, created with
  ``check_same_thread=False`` so it can be used from worker threads.
- WAL + ``synchronous=NORMAL`` + ``busy_timeout=5000`` so multiple connections
  against one file do not spuriously fail with ``SQLITE_BUSY``.
- Two independent write locks. Audit appends run on the event loop while job and
  artifact writes run via ``asyncio.to_thread``; a single shared lock would let an
  audit write block the loop waiting on a worker thread. Audit has its own lock
  and connection; jobs and artifacts share a second pair.
- ``init_schema`` is idempotent (``CREATE ... IF NOT EXISTS``) and called exactly
  once at application startup.
"""

import sqlite3
import threading
from pathlib import Path
from typing import Union

_connections: dict[str, sqlite3.Connection] = {}
_connections_guard = threading.Lock()

# Audit writes happen on the event loop; job/artifact writes happen in worker
# threads. Keep the two paths on separate locks so neither blocks the other.
audit_lock = threading.Lock()
jobs_lock = threading.Lock()

_SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
  job_id     TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  status     TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id TEXT PRIMARY KEY,
  job_id      TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  status      TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  data        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_artifacts_job  ON artifacts(job_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_user ON artifacts(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp  TEXT NOT NULL,
  event_type TEXT NOT NULL,
  job_id     TEXT,
  user_id    TEXT,
  data       TEXT NOT NULL,
  prev_hash  TEXT NOT NULL,
  hash       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_job ON audit_events(job_id, seq);
"""

_initialized: set[str] = set()
_init_guard = threading.Lock()


def _key(path: Union[str, Path]) -> str:
    return str(Path(path).resolve())


def get_connection(path: Union[str, Path]) -> sqlite3.Connection:
    """Return (creating if needed) the shared connection for ``path``."""
    key = _key(path)
    with _connections_guard:
        conn = _connections.get(key)
        if conn is None:
            Path(key).parent.mkdir(parents=True, exist_ok=True)
            conn = sqlite3.connect(key, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            conn.execute("PRAGMA foreign_keys=ON")
            conn.execute("PRAGMA busy_timeout=5000")
            _connections[key] = conn
        return conn


def close_connection(path: Union[str, Path]) -> None:
    """Close and drop the cached connection (used by restart tests)."""
    key = _key(path)
    with _connections_guard:
        conn = _connections.pop(key, None)
        if conn is not None:
            conn.close()
    with _init_guard:
        _initialized.discard(key)


def init_schema(conn: sqlite3.Connection) -> None:
    """Create tables/indexes once per database connection."""
    row = conn.execute("PRAGMA database_list").fetchone()
    key = _key(row[2]) if row and row[2] else f"conn-{id(conn)}"
    with _init_guard:
        if key in _initialized:
            return
        conn.executescript(_SCHEMA)
        conn.commit()
        _initialized.add(key)
