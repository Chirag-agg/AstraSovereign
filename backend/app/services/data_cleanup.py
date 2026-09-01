"""Local data cleanup / retention policy (issue #9).

Age-based cleanup for the repo's local data directories:

- ``data/workspaces/<user>/<job>/`` — per-job agent workspaces (each contains
  any generated ``artifacts/`` for that job, so deleting an old workspace also
  removes its artifacts).
- ``data/uploads/<user>/`` — uploaded document files.
- ``data/tmp/`` — rendered page images (Phase 8 already cleans these per
  operation; this only removes leftovers).

Safety: operates only under an explicit root, never follows symlinks out of the
root, prunes empty parent directories, defaults to a dry run (``--yes`` to
delete), and refuses nothing outside the root. Pure stdlib — no new
dependencies.

CLI (run from ``backend/``)::

    python -m app.services.data_cleanup --help          # options
    python -m app.services.data_cleanup                 # dry-run report
    python -m app.services.data_cleanup --yes           # delete
    python -m app.services.data_cleanup --yes --max-age-days 60
"""

import argparse
import shutil
import sys
import time
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_ROOT = REPO_ROOT / "data"

DEFAULT_WORKSPACES = DATA_ROOT / "workspaces"
DEFAULT_UPLOADS = DATA_ROOT / "uploads"
DEFAULT_TMP = DATA_ROOT / "tmp"
DEFAULT_MAX_AGE_DAYS = 30


@dataclass
class CleanupReport:
    """Counts of what would be / was removed."""

    removed_files: int = 0
    removed_dirs: int = 0
    freed_bytes: int = 0
    skipped: int = 0

    def lines(self) -> list[str]:
        return [
            f"removed files:   {self.removed_files}",
            f"removed dirs:    {self.removed_dirs}",
            f"freed bytes:     {self.freed_bytes}",
            f"skipped:         {self.skipped}",
        ]


def _age_days(path: Path, now: float) -> float:
    try:
        return (now - path.stat().st_mtime) / 86400.0
    except OSError:
        return float("inf")


def _old(path: Path, max_age_days: float, now: float) -> bool:
    return _age_days(path, now) > max_age_days


def _remove_file(path: Path, report: CleanupReport, dry_run: bool) -> None:
    try:
        report.freed_bytes += path.stat().st_size
    except OSError:
        pass
    report.removed_files += 1
    if not dry_run:
        try:
            path.unlink()
        except OSError:
            report.skipped += 1


def _remove_tree(path: Path, report: CleanupReport, dry_run: bool) -> None:
    report.removed_dirs += 1
    if not dry_run:
        try:
            shutil.rmtree(path)
        except OSError:
            report.skipped += 1


def _prune_empty_dirs(root: Path, report: CleanupReport, dry_run: bool) -> None:
    """Remove empty directories bottom-up (deepest first, never the root)."""
    if not root.is_dir():
        return
    for path in sorted(root.rglob("*"), key=lambda p: len(p.parts), reverse=True):
        if path.is_dir() and not path.is_symlink():
            try:
                if not any(path.iterdir()):
                    report.removed_dirs += 1
                    if not dry_run:
                        path.rmdir()
            except OSError:
                report.skipped += 1


def cleanup_old_files(
    root: Path,
    max_age_days: float = DEFAULT_MAX_AGE_DAYS,
    now: float | None = None,
    dry_run: bool = True,
) -> CleanupReport:
    """Remove files older than ``max_age_days`` under ``root``, then prune empty dirs."""
    report = CleanupReport()
    root = Path(root)
    if not root.exists():
        return report
    now = time.time() if now is None else now
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            report.skipped += 1
            continue
        if path.is_file() and _old(path, max_age_days, now):
            _remove_file(path, report, dry_run)
    _prune_empty_dirs(root, report, dry_run)
    return report


def cleanup_workspace_dirs(
    workspaces_root: Path,
    max_age_days: float = DEFAULT_MAX_AGE_DAYS,
    now: float | None = None,
    dry_run: bool = True,
) -> CleanupReport:
    """Remove ``<root>/<user>/<job>`` workspaces older than ``max_age_days``.

    A job workspace is removed whole (this includes its ``artifacts/``), then
    empty per-user directories are pruned.
    """
    report = CleanupReport()
    root = Path(workspaces_root)
    if not root.exists():
        return report
    now = time.time() if now is None else now
    for user_dir in sorted(root.iterdir()):
        if not user_dir.is_dir() or user_dir.is_symlink():
            continue
        for job_dir in sorted(user_dir.iterdir()):
            if job_dir.is_dir() and not job_dir.is_symlink() and _old(job_dir, max_age_days, now):
                _remove_tree(job_dir, report, dry_run)
    _prune_empty_dirs(root, report, dry_run)
    return report


def cleanup_all(
    workspaces_root: Path = DEFAULT_WORKSPACES,
    uploads_root: Path = DEFAULT_UPLOADS,
    tmp_root: Path = DEFAULT_TMP,
    max_age_days: float = DEFAULT_MAX_AGE_DAYS,
    now: float | None = None,
    dry_run: bool = True,
) -> dict[str, CleanupReport]:
    """Run the full documented retention policy across the local data dirs."""
    return {
        "workspaces": cleanup_workspace_dirs(workspaces_root, max_age_days, now, dry_run),
        "uploads": cleanup_old_files(uploads_root, max_age_days, now, dry_run),
        "tmp": cleanup_old_files(tmp_root, max_age_days, now, dry_run),
    }


def _cli(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="data_cleanup",
        description="Age-based cleanup of the local data directories (dry run by default).",
    )
    parser.add_argument("--workspaces", type=Path, default=DEFAULT_WORKSPACES)
    parser.add_argument("--uploads", type=Path, default=DEFAULT_UPLOADS)
    parser.add_argument("--tmp", type=Path, default=DEFAULT_TMP)
    parser.add_argument("--max-age-days", type=float, default=DEFAULT_MAX_AGE_DAYS)
    parser.add_argument("--yes", action="store_true", help="actually delete (default is dry run)")
    parser.add_argument("--dry-run", dest="dry_run", action="store_true", help="report only (default)")
    args = parser.parse_args(argv)

    dry_run = not args.yes
    reports = cleanup_all(
        workspaces_root=args.workspaces,
        uploads_root=args.uploads,
        tmp_root=args.tmp,
        max_age_days=args.max_age_days,
        dry_run=dry_run,
    )
    for name, report in reports.items():
        print(f"[{name}]")
        for line in report.lines():
            print(f"  {line}")
    print("dry-run" if dry_run else "deleted")
    return 0


if __name__ == "__main__":
    sys.exit(_cli())
