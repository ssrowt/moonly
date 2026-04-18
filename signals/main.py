"""
Moonly Signals API — FastAPI backend.
Logic: H1 trend (SMA20/50) → M15 zones (FVG + Order Block) → retest → signal.
Data: OKX public API (no keys required).
Cache: 45 seconds.
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from data import TOP_40_SYMBOLS, fetch_all
from signals import generate_signal, filter_for_plan

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger("moonly")

# ─── Cache ────────────────────────────────────────────────────────────────────

_cache: dict = {
    "signals": [],
    "updated_at": None,
    "error": None,
    "refresh_count": 0,
}

REFRESH_INTERVAL = 45  # seconds


async def _do_refresh() -> None:
    try:
        candles_map = await fetch_all(TOP_40_SYMBOLS)
        if not candles_map:
            raise RuntimeError("No candle data from OKX")

        signals = []
        seen: set = set()

        for symbol, (h1, m15) in candles_map.items():
            if symbol in seen:
                continue
            if h1 is None or m15 is None:
                continue
            try:
                sig = generate_signal(symbol, h1, m15)
                if sig:
                    signals.append(sig)
                    seen.add(symbol)
            except Exception as exc:
                logger.warning("Signal error [%s]: %s", symbol, exc)

        # Sort by score descending
        signals.sort(key=lambda s: s["score"], reverse=True)

        _cache["signals"] = signals
        _cache["updated_at"] = datetime.now(timezone.utc).isoformat()
        _cache["error"] = None
        _cache["refresh_count"] += 1

        logger.info(
            "Refresh #%d — %d signals from %d symbols",
            _cache["refresh_count"],
            len(signals),
            len(candles_map),
        )

    except Exception as exc:
        logger.error("Refresh failed: %s", exc)
        _cache["error"] = str(exc)


async def _refresh_loop() -> None:
    while True:
        await _do_refresh()
        await asyncio.sleep(REFRESH_INTERVAL)


# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_refresh_loop())
    try:
        yield
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)


# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Moonly Signals API",
    description="H1 trend + M15 FVG/OB signals. OKX data, no API keys.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "ok": True,
        "service": "moonly-signals",
        "version": "2.0.0",
        "cached_signals": len(_cache.get("signals", [])),
        "refresh_count": _cache["refresh_count"],
        "updated_at": _cache.get("updated_at"),
        "error": _cache.get("error"),
    }


@app.get("/signals")
async def get_signals(
    plan: str = Query(default="free", pattern="^(free|pro|deluxe)$"),
):
    raw = _cache.get("signals", [])

    if not raw and _cache["error"]:
        return {
            "ok": False,
            "signals": [],
            "plan": plan,
            "count": 0,
            "updated_at": _cache.get("updated_at"),
            "error": "Signal data temporarily unavailable — retry shortly",
        }

    filtered = filter_for_plan(raw, plan)
    return {
        "ok": True,
        "signals": filtered,
        "plan": plan,
        "count": len(filtered),
        "updated_at": _cache.get("updated_at"),
    }


@app.get("/health")
async def health():
    return {
        "ok": True,
        "service": "moonly-signals",
        "cached_signals": len(_cache.get("signals", [])),
        "refresh_count": _cache["refresh_count"],
        "updated_at": _cache.get("updated_at"),
        "error": _cache.get("error"),
    }
