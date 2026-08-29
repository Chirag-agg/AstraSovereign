"""In-memory FIFO job queue.

One worker consumes from this queue; jobs are processed one at a time.
Priority is stored on the job model but priority scheduling is intentionally
not implemented yet (FIFO only).
"""

import asyncio


class JobQueue:
    def __init__(self) -> None:
        self._queue: asyncio.Queue[str] = asyncio.Queue()

    async def enqueue(self, job_id: str) -> None:
        await self._queue.put(job_id)

    async def dequeue(self) -> str:
        return await self._queue.get()

    def qsize(self) -> int:
        return self._queue.qsize()
