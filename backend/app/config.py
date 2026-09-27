"""Application configuration, driven entirely by environment variables."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/config.py -> parents[0]=backend/app, parents[1]=backend, parents[2]=repo root
REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Runtime settings. Every value can be overridden via environment variables
    or a local `.env` file (see `.env.example`). Nothing here is hardcoded in code."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Local Ollama endpoint. The backend must ONLY ever talk to this address.
    ollama_base_url: str = "http://localhost:11434"

    # Model used by POST /api/chat. Must be set in the environment / .env.
    default_model: str = ""

    # Uvicorn bind settings.
    host: str = "127.0.0.1"
    port: int = 8000

    # Ollama residency hint sent on every request ("5m" reproduces Ollama's own
    # default idle-unload). On a genuine capability switch between pipeline
    # nodes, the node sequence additionally force-unloads the outgoing model
    # (see OllamaService.unload_and_wait) rather than waiting out this timer.
    ollama_keep_alive: str = "5m"
    # Bounded wait for a forced unload to actually clear VRAM before the next
    # model's reservation is requested (best-effort; never blocks a job past
    # this deadline even if the unload doesn't complete in time).
    ollama_unload_wait_seconds: float = 2.0

    # Context window requested on every generation call. Ollama's own default is
    # 4096, which this app's system prompt plus one tool result already fills —
    # that is what produced the HTTP 500s this setting exists to remove. A model
    # whose KV cache is unusually cheap (e.g. sliding-window attention) declares
    # a larger window of its own in config/models.yaml.
    ollama_num_ctx: int = 16384
    # Cap on generated tokens per turn. Kept well under num_ctx so generation
    # cannot fill the window and leave no room for a final answer; it is also a
    # latency bound, since a CPU-offloaded model decodes at ~17 tok/s. A
    # reasoning model that legitimately needs more room overrides it per model.
    ollama_num_predict: int = 4096
    # Floor for the per-call generation cap once the remaining window is taken
    # into account. Below this, a reasoning model spends the whole budget
    # thinking and returns empty content, which is worse than truncating it.
    ollama_num_predict_min: int = 512
    # Fraction of the window a prompt may occupy before history is trimmed.
    # Ollama truncates an oversized prompt by silently dropping its middle,
    # which loses a tool result without saying so; trimming the oldest
    # observation ourselves is the same loss made visible and bounded.
    ollama_prompt_trim_ratio: float = 0.85
    # How many times one job may react to an overflow it did not predict.
    # Proactive trimming is per-call and unbounded by design; this bounds the
    # exceptional path so a job cannot loop on it.
    ollama_max_overflow_retries: int = 3

    # Which roster in config/models.yaml describes this machine (see the
    # `profiles` block there). Empty means the file's `default_profile`.
    # The intended venue box and a dev laptop have different silicon, and a
    # roster tuned for one is wrong on the other — the profile name is carried
    # into logs and benchmark output so a CPU-offloaded run is visibly a
    # different configuration rather than a mysteriously slow one.
    model_profile: str = ""

    # Path to the models configuration file (task type -> model mapping).
    models_config: str = str(REPO_ROOT / "config" / "models.yaml")

    # Agent loop limits (bounded, deterministic termination).
    max_agent_iterations: int = 10
    max_agent_tool_calls: int = 20

    # Per-job workspace root (data/workspaces/<user>/<job>/).
    workspaces_root: str = str(REPO_ROOT / "data" / "workspaces")

    # Docker code-execution sandbox (Phase 5). Enabled by default so the
    # code_execution tool is always registered; if Docker is unavailable the
    # tool reports a clean runtime error instead of failing silently. The image
    # must already exist locally — the backend never pulls images.
    sandbox_enabled: bool = True
    sandbox_python_image: str = "python:3.12-alpine"
    sandbox_timeout_seconds: float = 10.0
    sandbox_cpu_limit: str = "0.5"
    sandbox_memory_limit: str = "128m"
    sandbox_max_stdout_chars: int = 4096
    sandbox_max_stderr_chars: int = 4096

    # Sandbox auto-repair: on a failed run, ask the coding-capability model
    # for a fix and re-run internally (transparent to the agent's own
    # iteration/tool-call budget) before returning a single ToolResult.
    sandbox_repair_enabled: bool = True
    sandbox_repair_max_attempts: int = 2
    sandbox_repair_deadline_seconds: float = 90.0

    # Resource scheduler capacity (Phase 6). Mode "configured" uses the values
    # below; mode "auto" discovers local CPU/memory/GPU (informational).
    resource_capacity_mode: str = "configured"
    resource_cpu_cores: float = 8.0
    resource_memory_mb: int = 16384
    resource_gpu_vram_mb: int = 16384
    resource_gpu_count: int = 1

    # Local document knowledge base (Phase 7). All storage stays under the
    # knowledge base root (per-user subdirectories).
    knowledge_base_root: str = str(REPO_ROOT / "data" / "knowledge")
    # Per-document extraction artifacts (elements + markdown) served by
    # read_document.
    extraction_root: str = str(REPO_ROOT / "data" / "extractions")
    uploads_root: str = str(REPO_ROOT / "data" / "uploads")

    # Deterministic text chunking.
    chunk_size: int = 800
    chunk_overlap: int = 100

    # Local embedding model (served by the local Ollama instance).
    embedding_model: str = "nomic-embed-text"

    # document_search tool limits. A floor above 1 exists because a model
    # narrowing to a single chunk (observed: top_k=1 called twice, identically)
    # is the retrieval failure mode most likely to miss the current revision
    # of a procedure in favor of whatever ranked first by chance.
    document_search_default_top_k: int = 5
    document_search_min_top_k: int = 3
    document_search_max_top_k: int = 10
    document_search_max_chunk_chars: int = 1000

    # read_document token budget (characters); whole documents under this are
    # served in full, longer ones are truncated with a marker.
    read_document_max_chars: int = 12000

    # Multimodal OCR + vision (Phase 8). Everything runs locally — the OCR
    # engine (RapidOCR) and PDF rendering (pypdfium2) are local libraries, and
    # the vision model is the registry-configured local multimodal model.
    ocr_enabled: bool = True
    ocr_max_pages: int = 50
    # Per-page OCR routing. A PDF page whose visible content is a page-scale
    # raster (a scan) and whose text layer is shorter than this is routed to OCR
    # instead of being indexed from that layer, so a scanned page carrying only
    # a stamped header or page number is still recognised rather than silently
    # reduced to the string "Page 3". 64 is a measured choice: the scenario
    # fixtures' scanned pages carry 0 chars of text layer and their typed pages
    # 410 and 1152 — an order of magnitude above a stamp, well below a
    # paragraph. A page that is not raster-dominant keeps its text layer
    # however short that layer is.
    ocr_page_min_text_chars: int = 64
    ocr_max_image_dimension: int = 4000
    ocr_render_scale: float = 2.0
    vision_max_pages: int = 5
    vision_resource_wait_rounds: int = 5
    multimodal_tmp_root: str = str(REPO_ROOT / "data" / "tmp")

    # Structured (JSON) logging.
    log_level: str = "INFO"
    log_file: str = str(REPO_ROOT / "logs" / "backend.log")

    # Frontend cross-origin allow-list (comma-separated). Only local dev
    # origins by default; the backend never talks to external services.
    cors_origins: str = "http://localhost:3000"

    # Local audit trail (Phase 11): append-only JSONL under this root.
    audit_root: str = str(REPO_ROOT / "data" / "audit")

    # Durable store snapshots so job/artifact history survives restarts.
    job_store_root: str = str(REPO_ROOT / "data" / "jobs")
    artifact_store_root: str = str(REPO_ROOT / "data" / "artifacts")

    # Cowork: persistent per-user project workspaces (AI-IDE mode).
    cowork_enabled: bool = True
    cowork_projects_root: str = str(REPO_ROOT / "data" / "projects")
    cowork_file_max_bytes: int = 1_000_000
    cowork_tree_max_entries: int = 500

    # Local PowerPoint rendering via the PptxGenJS node script (presentation/).
    presentation_renderer_script: str = str(
        REPO_ROOT / "presentation" / "src" / "render.cjs"
    )
    presentation_node_command: str = "node"
    presentation_timeout_seconds: float = 90.0

    # Durable SQLite store (jobs, artifact metadata, hash-chained audit, users).
    database_path: str = str(REPO_ROOT / "data" / "astra.db")

    # Real local authentication. session_secret overrides the auto-generated
    # data/session_secret.key (created on first boot if unset, so restarts
    # don't invalidate every session). session_cookie_secure should be true
    # once TLS is terminated in front of the app; false is correct for a
    # plain-HTTP local/air-gapped deployment.
    session_secret: str = ""
    session_secret_file: str = str(REPO_ROOT / "data" / "session_secret.key")
    session_ttl_seconds: int = 43200
    session_cookie_secure: bool = False

    # Demo mode: run the app with authentication off. A request needs no session
    # cookie and no password — the caller is taken from the X-User-ID/X-Role
    # header, defaulting to DEFAULT_USER_ID when neither is sent, so anyone who
    # can reach the port can act as any user, admin included. That is the point
    # of a demo, and it is why this defaults to False and must be switched on
    # explicitly: a deployment that forgets to set it stays closed, whereas one
    # that sets it is knowingly open. Never enable it on a reachable host.
    demo_mode: bool = False

    # Model fallback: follow each entry's declared `fallback_to` chain when the
    # configured model is unavailable. Disable for benchmarks (bench/ forces it
    # off) so routing effectiveness is measured without silent substitution.
    model_fallback_enabled: bool = True

    # Benchmark determinism: force greedy decoding (temperature 0) and a fixed
    # seed on every generation call, so a benchmark measures the system rather
    # than sampling noise. Production keeps sampling; `bench/` forces this on.
    bench_mode: bool = False
    bench_seed: int = 7

    # Semantic capability classifier: minimum cosine similarity to accept a
    # capability label; below it the job is `general`. See
    # app/services/capability_classifier.py and bench/classifier_eval.py.
    classifier_threshold: float = 0.55

    # The job-plan filler: a ~1B model that fills ONLY the plan fields the
    # deterministic layer left unset (see app/services/plan_filler.py). Default
    # off — it is enabled only if bench/plan_eval.py shows it beats the
    # deterministic-only baseline on the implicit cases. It is paid for like any
    # other model (a declared resource reservation), so a deployment that does
    # not want it simply leaves it off.
    planner_enabled: bool = False
    planner_model: str = "qwen3:1.7b"


@lru_cache
def get_settings() -> Settings:
    return Settings()
