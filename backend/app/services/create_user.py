"""One-shot CLI: create a local user account.

The only user auto-created is the bootstrap admin on first boot (see
``main.py``'s ``lifespan``); every other account is created explicitly here,
never seeded with an invented password.

Usage:

    python -m app.services.create_user --username jane --role user
    python -m app.services.create_user --username sam --role admin \
        --database data/astra.db
"""

import argparse
import asyncio
import getpass

from app.config import get_settings
from app.services.auth_store import SqliteUserStore


async def _run(database_path: str, username: str, role: str) -> None:
    store = SqliteUserStore(database_path)
    existing = await store.get_by_username(username)
    if existing is not None:
        raise SystemExit(f"User '{username}' already exists.")

    password = getpass.getpass(f"Password for '{username}': ")
    confirm = getpass.getpass("Confirm password: ")
    if not password:
        raise SystemExit("Password must not be empty.")
    if password != confirm:
        raise SystemExit("Passwords did not match.")

    user = await store.create(username, password, role=role)
    print(f"Created user '{user.username}' (id={user.id}, role={user.role}).")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--username", required=True)
    parser.add_argument("--role", default="user", choices=["user", "admin"])
    parser.add_argument("--database", default=None, help="Defaults to DATABASE_PATH.")
    args = parser.parse_args()

    database_path = args.database or get_settings().database_path
    asyncio.run(_run(database_path, args.username, args.role))


if __name__ == "__main__":
    main()
