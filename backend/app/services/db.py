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

_connections: dict[tuple[str, str], sqlite3.Connection] = {}
_connections_guard = threading.Lock()

# Audit writes happen on the event loop; job/artifact writes happen in worker
# threads. They use separate connections AND separate locks so neither blocks
# the other (two writers against one file, with WAL + busy_timeout).
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

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

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


def _open(path: str) -> sqlite3.Connection:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn


def _connection(path: Union[str, Path], role: str) -> sqlite3.Connection:
    file_key = _key(path)
    key = (role, file_key)
    with _connections_guard:
        conn = _connections.get(key)
        if conn is None:
            conn = _open(file_key)
            _connections[key] = conn
        return conn


def get_connection(path: Union[str, Path]) -> sqlite3.Connection:
    """Shared connection for job and artifact stores."""
    return _connection(path, "jobs")


def get_audit_connection(path: Union[str, Path]) -> sqlite3.Connection:
    """Dedicated connection for the audit store (separate writer and lock)."""
    return _connection(path, "audit")


def close_connection(path: Union[str, Path]) -> None:
    """Close and drop the cached connections (used by restart tests)."""
    file_key = _key(path)
    with _connections_guard:
        for role in ("jobs", "audit"):
            conn = _connections.pop((role, file_key), None)
            if conn is not None:
                conn.close()
    with _init_guard:
        _initialized.discard(f"jobs:{file_key}")
        _initialized.discard(f"audit:{file_key}")


def init_schema(conn: sqlite3.Connection, role: str = "jobs") -> None:
    """Create tables/indexes once per database connection.

    Serialized under both write locks: ``executescript`` implicitly commits on
    this connection, so letting it run while another thread holds an open
    transaction on the same connection produces
    ``cannot commit - no transaction is active``.
    """
    row = conn.execute("PRAGMA database_list").fetchone()
    file_key = _key(row[2]) if row and row[2] else f"conn-{id(conn)}"
    key = f"{role}:{file_key}"
    with _init_guard:
        if key in _initialized:
            return
        with jobs_lock, audit_lock:
            if key in _initialized:
                return
            conn.executescript(_SCHEMA)
            conn.commit()
            _initialized.add(key)
