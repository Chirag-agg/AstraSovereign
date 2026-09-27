"""Measure each configured model's GPU-resident and host-resident footprint.

    backend\\.venv\\Scripts\\python.exe bench\\measure_model_footprint.py

Prints, per model, the bytes Ollama reports as resident (``size``) and the
portion of that on the GPU (``size_vram``), so the host figure is
``size - size_vram``. Those are exactly the two numbers
``config/models.yaml`` declares for each entry:

- ``gpu_vram_mb`` — the GPU portion, checked against ``RESOURCE_GPU_VRAM_MB``.
- ``memory_mb``    — the host portion (offloaded weights included), checked
  against ``RESOURCE_MEMORY_MB``.

They must be measured on the machine that will run the models, because the
split depends on the card: a model larger than VRAM has as many layers on the
GPU as fit, and the rest in host RAM. The numbers shipped in
``config/models.yaml`` were measured on a 6144 MiB laptop GPU; the venue box
needs its own.

Each model is loaded at the window it is declared with and with a trivial
prompt, since the KV cache is allocated for the whole window either way. Pass
``--model NAME=NUM_CTX`` to measure a model not in the config, or
``--profile NAME`` to measure a different roster.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.config import get_settings  # noqa: E402
from app.services.model_registry import ModelRegistry  # noqa: E402

MIB = 1024 * 1024


def ps(base_url: str) -> list[dict]:
    return httpx.get(f"{base_url}/api/ps", timeout=60).json().get("models", [])


def unload(base_url: str, model: str) -> None:
    try:
        httpx.post(
            f"{base_url}/api/generate",
            json={"model": model, "keep_alive": 0},
            timeout=120,
        )
    except httpx.HTTPError:
        pass


def measure(base_url: str, model: str, num_ctx: int) -> tuple[int, int] | None:
    """Load `model` at `num_ctx` and return (total_bytes, vram_bytes)."""
    unload(base_url, model)
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": "hi"}],
        "stream": False,
        "options": {"num_ctx": num_ctx, "num_predict": 8},
    }
    try:
        response = httpx.post(f"{base_url}/api/chat", json=payload, timeout=1800)
    except httpx.HTTPError as exc:
        print(f"{model}: TRANSPORT {exc!r}", flush=True)
        return None
    if response.status_code != 200:
        print(
            f"{model}: HTTP {response.status_code} {response.text[:200]!r}",
            flush=True,
        )
        return None
    entries = [
        e
        for e in ps(base_url)
        if (e.get("name") or e.get("model")) == model
    ]
    if not entries:
        print(f"{model}: not resident after the call", flush=True)
        return None
    entry = entries[0]
    return int(entry.get("size", 0)), int(entry.get("size_vram", 0))


def main() -> int:
    settings = get_settings()
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=settings.ollama_base_url)
    parser.add_argument("--profile", default=settings.model_profile or None)
    parser.add_argument(
        "--model",
        action="append",
        default=[],
        metavar="NAME=NUM_CTX",
        help="measure an extra model not present in the config",
    )
    args = parser.parse_args()

    registry = ModelRegistry.from_file(settings.models_config, profile=args.profile)
    windows = registry.model_options()

    targets: list[tuple[str, int]] = []
    for task_type in registry.task_types():
        config = registry.get(task_type)
        num_ctx = (windows.get(config.model) or {}).get("num_ctx")
        entry = (config.model, num_ctx or settings.ollama_num_ctx)
        if entry not in targets:
            targets.append(entry)
    for spec in args.model:
        name, _, ctx = spec.partition("=")
        targets.append((name, int(ctx) if ctx else settings.ollama_num_ctx))

    print(f"profile: {registry.profile or '(none)'}  base_url: {args.base_url}\n")
    for model, num_ctx in targets:
        result = measure(args.base_url, model, num_ctx)
        if result is None:
            continue
        total, vram = result
        host = total - vram
        print(
            f"{model} @ num_ctx={num_ctx}\n"
            f"    total {total / MIB:8.0f} MiB   "
            f"vram {vram / MIB:8.0f} MiB   host {host / MIB:8.0f} MiB\n"
            f"    declare  gpu_vram_mb: {vram / MIB:.0f}   "
            f"memory_mb: {host / MIB:.0f}",
            flush=True,
        )

    for model, _ in targets:
        unload(args.base_url, model)
    print("\ndone — models unloaded", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
