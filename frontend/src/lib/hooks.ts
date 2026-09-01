// Polling hooks. The backend exposes no streaming/WebSocket endpoint, so the UI
// polls at sensible intervals, stops at terminal states, and pauses in hidden tabs.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, getHealth, getJob, getJobAudit, listDocuments, listJobs } from "./api";
import type { AuditEvent, DocumentMeta, Health, Job, JobSummary } from "./types";
import { isTerminalStatus } from "./types";

export const USER_IDS = ["user-001", "user-002", "user-003", "user-004", "user-005"];
const USER_STORAGE_KEY = "sovereign.active-user";

const POLL_JOB_MS = 1000;
const POLL_LIST_MS = 2000;
const POLL_HEALTH_MS = 3000;

/** Selected dev user, persisted to localStorage. No real authentication. */
export function useActiveUser(): [string, (user: string) => void] {
  const [user, setUser] = useState<string>(() => {
    if (typeof window === "undefined") {
      return USER_IDS[0];
    }
    const stored = window.localStorage.getItem(USER_STORAGE_KEY);
    return stored && USER_IDS.includes(stored) ? stored : USER_IDS[0];
  });

  const changeUser = useCallback((next: string) => {
    setUser(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(USER_STORAGE_KEY, next);
    }
  }, []);

  return [user, changeUser];
}

interface PollingOptions<T> {
  intervalMs: number;
  /** Stop polling once the value satisfies this predicate. */
  shouldStop?: (value: T) => boolean;
  /** Keep polling after a non-404 error (reconnect). Default true. */
  retryOnError?: boolean;
  /** Stop after a 404. Default true. */
  stopOnNotFound?: boolean;
}

/**
 * Poll `fetcher` every `intervalMs` until `shouldStop` (or an error) stops it.
 * Pauses while the tab is hidden. Pass stable `deps` (e.g. the user/job id) so
 * the effect restarts when inputs change — or key the consuming component by
 * the job id instead.
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  { intervalMs, shouldStop, retryOnError = true, stopOnNotFound = true }: PollingOptions<T>,
  deps: unknown[] = [],
): { data: T | null; error: string | null; stopped: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const shouldStopRef = useRef(shouldStop);
  shouldStopRef.current = shouldStop;

  useEffect(() => {
    if (stopped) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const tick = async () => {
      try {
        const value = await fetcherRef.current();
        if (cancelled) {
          return;
        }
        setData(value);
        setError(null);
        if (shouldStopRef.current?.(value)) {
          setStopped(true);
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Backend error";
        setError(message);
        const notFound = err instanceof ApiError && err.status === 404;
        if (!retryOnError || (stopOnNotFound && notFound)) {
          setStopped(true);
        }
      }
    };

    const start = () => {
      if (timer === undefined) {
        timer = setInterval(tick, intervalMs);
      }
    };
    const stop = () => {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    };

    void tick();
    start();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        start();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // `stopped` is intentional: it stops the interval. Deps restart on input change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopped, intervalMs, retryOnError, stopOnNotFound, ...deps]);

  return { data, error, stopped };
}

/** Poll a single job until it reaches a terminal state (caller keys by job id). */
export function useJob(userId: string, jobId: string): {
  job: Job | null;
  error: string | null;
  stopped: boolean;
} {
  const result = usePolling<Job>(
    () => getJob(userId, jobId),
    { intervalMs: POLL_JOB_MS, shouldStop: (job) => isTerminalStatus(job.status) },
    [userId, jobId],
  );
  return { job: result.data, error: result.error, stopped: result.stopped };
}

/** Poll the caller's job list (newest first). */
export function useJobs(userId: string): {
  jobs: JobSummary[] | null;
  error: string | null;
} {
  const result = usePolling<JobSummary[]>(
    () => listJobs(userId),
    { intervalMs: POLL_LIST_MS, retryOnError: true },
    [userId],
  );
  return { jobs: result.data, error: result.error };
}

/** Poll backend/system health. */
export function useHealth(): { health: Health | null; error: string | null } {
  const result = usePolling<Health>(
    () => getHealth(),
    { intervalMs: POLL_HEALTH_MS, retryOnError: true },
    [],
  );
  return { health: result.data, error: result.error };
}

/** Poll the caller's document list. */
export function useDocuments(userId: string): {
  documents: DocumentMeta[] | null;
  error: string | null;
} {
  const result = usePolling<DocumentMeta[]>(
    () => listDocuments(userId),
    { intervalMs: POLL_LIST_MS, retryOnError: true },
    [userId],
  );
  return { documents: result.data, error: result.error };
}

/** Poll a job's audit trail; stops once the job is terminal. */
export function useJobAudit(
  userId: string,
  jobId: string,
  terminal: boolean,
): { events: AuditEvent[] | null; error: string | null } {
  const result = usePolling<AuditEvent[]>(
    () => getJobAudit(userId, jobId),
    { intervalMs: POLL_LIST_MS, shouldStop: () => terminal, retryOnError: true },
    [userId, jobId, terminal],
  );
  return { events: result.data, error: result.error };
}
