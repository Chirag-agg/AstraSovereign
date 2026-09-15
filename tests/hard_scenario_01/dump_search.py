"""Dump what document_search actually returns for the hard-scenario fixtures.

    backend\\.venv\\Scripts\\python.exe tests\\hard_scenario_01\\dump_search.py
"""

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "tests" / "hard_scenario_01"))

from app.config import get_settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.services.log_context import set_job_context  # noqa: E402
from run_nodes_direct import ingest  # noqa: E402

QUERIES = [
    "Tank 204 shell course thickness readings",
    "Tank 204 nameplate diameter height specific gravity allowable stress joint efficiency",
    "Course 5 thickness reading",
]


async def main() -> None:
    get_settings.cache_clear()
    app = create_app()
    user = "user-001"
    await ingest(app, user)
    tool = app.state.tool_registry.get("document_search")
    workspace = await app.state.workspace_manager.create_workspace(user, "job-dump")
    set_job_context(job_id="job-dump", user_id=user)
    for query in QUERIES:
        result = await tool.execute(workspace, {"query": query, "top_k": 5})
        print("=" * 70)
        print("QUERY:", query)
        print("SUMMARY:", result.summary)
        print("CONTENT:")
        print((result.content or "")[:2500])

    # Does the node's workspace show any attached files?
    list_tool = app.state.tool_registry.get("list_files")
    listing = await list_tool.execute(workspace, {})
    print("=" * 70)
    print("list_files(workspace):", listing.summary)
    print(listing.content)


if __name__ == "__main__":
    asyncio.run(main())
