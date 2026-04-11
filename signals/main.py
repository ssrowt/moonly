"""
Moonly Signals API
FastAPI backend that generates crypto trading signals from Binance 15m klines
and streams live prices via Binance WebSocket.

Endpoints:
  GET       /signals?plan=free|pro|deluxe  — trading signals (refreshed every 45s)
  GET       /prices                        — live price snapshot (all tracked symbols)
  GET       /prices/{symbol}               — single symbol price  (e.g. BTCUSDT)
  WebSocket /ws/prices                     — push snapshot every second to clients
  GET       /health
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

import prices as price_stream
from binance import TOP_40_SYMBOLS, fetch_all_candles
from signals import filter_for_plan, generate_signal

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger("moonly")

# ─── Signal cache ─────────────────────────────────────────────────────────────

_cache: dict = {
    "signals":       [],
    "updated_at":    None,
    "error":         None,
    "refresh_count": 0,
}

REFRESH_INTERVAL = 45   # seconds


# ─── Background: signal refresh ───────────────────────────────────────────────

async def _do_refresh() -> None:
    try:
        candles_map = await fetch_all_candles(TOP_40_SYMBOLS)
        if not candles_map:
            raise RuntimeError("No candle data returned from Binance")

        signals: list[dict] = []
        seen: set[str] = set()

        for symbol, candles in candles_map.items():
            if symbol in seen:
                continue
            try:
                sig = generate_signal(symbol, candles)
                if sig:
                    signals.append(sig)
                    seen.add(symbol)
            except Exception as exc:
                logger.warning("Signal error [%s]: %s", symbol, exc)

        signals.sort(key=lambda s: (s["is_top"], s["score"]), reverse=True)

        _cache["signals"]        = signals
        _cache["updated_at"]     = datetime.now(timezone.utc).isoformat()
        _cache["error"]          = None
        _cache["refresh_count"] += 1

        logger.info(
            "Refresh #%d — %d/%d symbols with signals",
            _cache["refresh_count"], len(signals), len(candles_map),
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
    # Start signal refresh loop
    signal_task = asyncio.create_task(_refresh_loop())

    # Start Binance WebSocket price stream + broadcaster
    price_tasks = await price_stream.start(TOP_40_SYMBOLS)

    all_tasks = [signal_task, *price_tasks]
    try:
        yield
    finally:
        for t in all_tasks:
            t.cancel()
        await asyncio.gather(*all_tasks, return_exceptions=True)


# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Moonly Signals API",
    description="Crypto trading signals + live Binance prices.",
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ─── Signal routes ────────────────────────────────────────────────────────────

@app.get("/signals", summary="Trading signals by subscription plan")
async def get_signals(
    plan: str = Query(
        default="free",
        pattern="^(free|pro|deluxe)$",
        description="Subscription plan: free | pro | deluxe",
    )
):
    """
    | Plan   | Limit | Score range | Top signals | AI analysis |
    |--------|-------|-------------|-------------|-------------|
    | free   | 3     | 5.0 – 7.9   | No          | No          |
    | pro    | 10    | 6.0 – 9.9   | No          | No          |
    | deluxe | 40    | 5.0 – 10.0  | Yes         | Yes         |
    """
    raw = _cache.get("signals", [])

    if not raw and _cache["error"]:
        return {
            "ok":         False,
            "signals":    [],
            "plan":       plan,
            "count":      0,
            "updated_at": _cache.get("updated_at"),
            "error":      "Signal data temporarily unavailable — please retry shortly",
        }

    return {
        "ok":         True,
        "signals":    filter_for_plan(raw, plan),
        "plan":       plan,
        "count":      len(filter_for_plan(raw, plan)),
        "updated_at": _cache.get("updated_at"),
    }


# ─── Price routes ─────────────────────────────────────────────────────────────

@app.get("/prices", summary="Live price snapshot — all tracked symbols")
async def get_prices():
    """
    Returns the latest ticker data for all 40 tracked symbols.
    Updated in real-time via Binance WebSocket (miniTicker stream).

    Each entry: symbol, price, open, high, low, change24h (%), volume (USDT)
    """
    data = price_stream.snapshot()
    return {
        "ok":     True,
        "count":  len(data),
        "prices": data,
    }


@app.get("/prices/{symbol}", summary="Live price for a single symbol")
async def get_price(symbol: str):
    """
    Returns the latest ticker for one symbol (e.g. BTCUSDT).
    """
    entry = price_stream.get_price(symbol.upper())
    if entry is None:
        raise HTTPException(
            status_code=404,
            detail=f"{symbol.upper()} not found — not in tracked list or stream not ready yet",
        )
    return {"ok": True, "price": entry}


@app.websocket("/ws/prices")
async def ws_prices(websocket: WebSocket):
    """
    WebSocket endpoint — pushes full price snapshot every second.

    Message format:
      { "type": "prices", "data": [ {symbol, price, change24h, ...}, ... ] }

    Connect with:
      ws://localhost:8000/ws/prices
    """
    await websocket.accept()
    price_stream.add_client(websocket)

    # Send current snapshot immediately on connect
    snap = price_stream.snapshot()
    if snap:
        import json
        await websocket.send_text(json.dumps({"type": "prices", "data": snap}))

    try:
        while True:
            # Keep connection alive; _broadcast_loop handles outgoing messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        price_stream.remove_client(websocket)


# ─── Shutdown ─────────────────────────────────────────────────────────────────

@app.post("/admin/shutdown")
async def shutdown():
    import os, signal
    os.kill(os.getpid(), signal.SIGTERM)
    return {"ok": True}


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "ok":             True,
        "service":        "moonly-signals",
        "cached_signals": len(_cache.get("signals", [])),
        "live_prices":    len(price_stream.snapshot()),
        "refresh_count":  _cache["refresh_count"],
        "updated_at":     _cache.get("updated_at"),
        "error":          _cache.get("error"),
    }
