"""Logging context propagated from the Agent to tools via ``contextvars``.

Tools execute without job/user arguments, but they should still emit structured
log events (e.g. ``code_execution_started``) that include ``job_id``/``user_id``.
The Agent sets this context before executing a tool; the tool reads it when
logging. Nothing secret is ever placed here.
"""

import contextvars
from typing import Optional

_JOB_CONTEXT: contextvars.ContextVar[Optional[dict]] = contextvars.ContextVar(
    "job_log_context", default=None
)


def set_job_context(**fields) -> None:
    _JOB_CONTEXT.set(dict(fields))


def get_job_context() -> dict:
    return dict(_JOB_CONTEXT.get() or {})
