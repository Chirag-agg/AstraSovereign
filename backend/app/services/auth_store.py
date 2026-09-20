"""Local user store + password hashing (Phase: real local authentication).

Stdlib-only crypto (``hashlib.pbkdf2_hmac`` + ``hmac.compare_digest`` +
``secrets``) — no new third-party dependency, consistent with this project's
own minimal-dependency, fully-offline review discipline (see
``docs/SOVEREIGNTY.md``'s dependency table). Password hashes/salts never
leave this module: ``UserStore`` methods return ``app.schemas.user.User``,
which has no password field at all.
"""

import asyncio
import hashlib
import hmac
import secrets
import sqlite3
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional

from app.schemas.user import User
from app.services import db

_PBKDF2_ITERATIONS = 200_000


def hash_password(password: str, salt: bytes) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS
    ).hex()


def verify_password(password: str, salt_hex: str, hash_hex: str) -> bool:
    try:
        salt = bytes.fromhex(salt_hex)
    except ValueError:
        return False
    candidate = hash_password(password, salt)
    return hmac.compare_digest(candidate, hash_hex)


def new_salt() -> bytes:
    return secrets.token_bytes(16)


def _new_user_id() -> str:
    return f"usr-{uuid.uuid4().hex[:12]}"


class UserStore(ABC):
    """Persistence interface for local user accounts."""

    @abstractmethod
    async def get_by_username(self, username: str) -> Optional[tuple[User, str, str]]:
        """Returns ``(User, password_hash, salt_hex)`` or ``None``."""

    @abstractmethod
    async def get_by_id(self, user_id: str) -> Optional[User]:
        ...

    @abstractmethod
    async def create(self, username: str, password: str, role: str = "user") -> User:
        """Creates a user with a freshly hashed/salted password."""

    @abstractmethod
    async def list_all(self) -> list[User]:
        ...

    @abstractmethod
    async def count(self) -> int:
        ...


class SqliteUserStore(UserStore):
    """Durable SQLite-backed user store (shares the jobs/artifacts db file)."""

    def __init__(self, path: str) -> None:
        self._path = path
        self._conn = db.get_connection(path)
        db.init_schema(self._conn)

    @staticmethod
    def _row_to_user(row: sqlite3.Row) -> User:
        return User(
            id=row["id"],
            username=row["username"],
            role=row["role"],
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    def _get_by_username_sync(self, username: str):
        with db.jobs_lock:
            row = self._conn.execute(
                "SELECT * FROM users WHERE username = ?", (username,)
            ).fetchone()
        if row is None:
            return None
        return self._row_to_user(row), row["password_hash"], row["salt"]

    async def get_by_username(self, username: str):
        return await asyncio.to_thread(self._get_by_username_sync, username)

    def _get_by_id_sync(self, user_id: str) -> Optional[User]:
        with db.jobs_lock:
            row = self._conn.execute(
                "SELECT * FROM users WHERE id = ?", (user_id,)
            ).fetchone()
        return self._row_to_user(row) if row is not None else None

    async def get_by_id(self, user_id: str) -> Optional[User]:
        return await asyncio.to_thread(self._get_by_id_sync, user_id)

    def _create_sync(self, username: str, password: str, role: str) -> User:
        salt = new_salt()
        password_hash = hash_password(password, salt)
        created = User(
            id=_new_user_id(),
            username=username,
            role=role,
            created_at=datetime.now(timezone.utc),
        )
        with db.jobs_lock:
            self._conn.execute(
                "INSERT INTO users (id, username, password_hash, salt, role, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (
                    created.id,
                    created.username,
                    password_hash,
                    salt.hex(),
                    created.role,
                    created.created_at.isoformat(),
                ),
            )
            self._conn.commit()
        return created

    async def create(self, username: str, password: str, role: str = "user") -> User:
        return await asyncio.to_thread(self._create_sync, username, password, role)

    def _list_all_sync(self) -> list[User]:
        with db.jobs_lock:
            rows = self._conn.execute("SELECT * FROM users").fetchall()
        return [self._row_to_user(row) for row in rows]

    async def list_all(self) -> list[User]:
        return await asyncio.to_thread(self._list_all_sync)

    def _count_sync(self) -> int:
        with db.jobs_lock:
            row = self._conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()
        return int(row["n"])

    async def count(self) -> int:
        return await asyncio.to_thread(self._count_sync)


class InMemoryUserStore(UserStore):
    """Pure in-memory user store (test double; no persistence)."""

    def __init__(self) -> None:
        # username -> (User, password_hash, salt_hex)
        self._by_username: dict[str, tuple[User, str, str]] = {}
        self._by_id: dict[str, User] = {}
        self._lock = asyncio.Lock()

    async def get_by_username(self, username: str):
        async with self._lock:
            return self._by_username.get(username)

    async def get_by_id(self, user_id: str) -> Optional[User]:
        async with self._lock:
            return self._by_id.get(user_id)

    async def create(self, username: str, password: str, role: str = "user") -> User:
        async with self._lock:
            salt = new_salt()
            password_hash = hash_password(password, salt)
            created = User(id=_new_user_id(), username=username, role=role)
            self._by_username[username] = (created, password_hash, salt.hex())
            self._by_id[created.id] = created
            return created

    async def list_all(self) -> list[User]:
        async with self._lock:
            return [entry[0] for entry in self._by_username.values()]

    async def count(self) -> int:
        async with self._lock:
            return len(self._by_username)
