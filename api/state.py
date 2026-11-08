"""In-memory backend state. Lives in ONE process: never run uvicorn with --workers."""
from __future__ import annotations

from collections import deque
from datetime import datetime, timezone

EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


class State:
    def __init__(self) -> None:
        self.rows_ingested = 0
        self._clear_run()
        self.run_id: str | None = None

    def _clear_run(self) -> None:
        self.sim_now: datetime | None = None
        self.homes_cache: list[dict] = []
        self.episodes: set[str] = set()
        self.events: deque[dict] = deque(maxlen=60)
        self.calls: dict[str, dict] = {}          # home_id -> {call_status, outcome}
        self.live_calls = 0
        self.saved_speed: int | None = None
        self.last_pred_bucket: int | None = None
        self.prev_power: dict[str, bool] = {}     # block -> power_on, for power events
        self.sim_state: dict | None = None        # cached simulator /state
        self.run_started: datetime | None = None  # simulated time of the run's first data
        self.focus_home: str | None = None        # the single home the presenter cut (demo story)
        self.ok_baseline: dict[str, float] = {}   # home -> temperature when the resident said "fine"

    def reset(self, run_id: str, at: datetime | None = None) -> None:
        """Start a new run: clear everything except rows_ingested. Idempotent per run_id."""
        if run_id == self.run_id:
            return
        sim_state = self.sim_state
        self._clear_run()
        self.sim_state = sim_state  # keep last known sim blocks/speed until refreshed
        self.run_id = run_id
        self.run_started = at
        self.add_event("reset", None, f"New run {run_id}", "info", t=at)

    def add_event(self, type_: str, home_id: str | None, text: str, severity: str,
                  t: datetime | None = None) -> None:
        self.events.append({"t": t or self.sim_now or EPOCH, "type": type_, "home_id": home_id,
                            "text": text, "severity": severity})


state = State()
