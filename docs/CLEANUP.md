# Local data cleanup & retention policy (issue #9)

The workbench writes local data under `data/`. Rendered page images under
`data/tmp/` are already cleaned automatically after each OCR/vision operation
(Phase 8). The remaining directories accumulate over time:

| Path | Contents | Policy |
| --- | --- | --- |
| `data/workspaces/<user>/<job>/` | per-job agent workspace incl. any generated `artifacts/` | remove when older than `MAX_AGE_DAYS` (default 30) |
| `data/uploads/<user>/` | uploaded document files | remove files older than `MAX_AGE_DAYS` |
| `data/tmp/` | leftover rendered page images | remove files older than `MAX_AGE_DAYS` (normally already empty) |

Deleting an old job workspace also removes its generated artifacts — completed
artifacts therefore remain accessible until their job workspace is cleaned
(documented behavior; no per-artifact lifecycle yet).

## Command

Run from `backend/` (stdlib only, no new dependencies):

```powershell
.\.venv\Scripts\python.exe -m app.services.data_cleanup            # dry-run report
.\.venv\Scripts\python.exe -m app.services.data_cleanup --yes      # delete
.\.venv\Scripts\python.exe -m app.services.data_cleanup --yes --max-age-days 60
```

Options: `--workspaces`, `--uploads`, `--tmp`, `--max-age-days`,
`--yes` (delete; default is a dry run).

## Safety

- Operates only under the explicit roots (`data/workspaces`, `data/uploads`,
  `data/tmp`) — never the repo root.
- Skips symlinks; prunes empty parent directories bottom-up.
- Dry run by default; `--yes` required to delete.

## Tests

`backend/tests/test_data_cleanup.py` covers old-vs-recent removal, dry run,
empty-dir pruning, missing roots, symlink skipping, and workspace/user
retention.
