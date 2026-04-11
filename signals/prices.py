"""
Live price streaming via Binance WebSocket miniTicker.

Architecture:
  _binance_listener()  — connects to Binance WS, writes updates to _prices dict
  _broadcast_loop()    — every second, pushes full snapshot to connected clients
  REST GET /prices     — instant snapshot from cache (no WS required by clients)
  WS  /ws/prices       — push-based: sends snapshot every second to connected clients
"""

import asyncio
import json
import logging
from typing import Optional

import websockets
from fastapi import WebSocket

logger = logging.getLogger("moonly.prices")

BINANCE_WS = "wss://stream.binance.com:9443/stream"

# ─── Shared state ─────────────────────────────────────────────────────────────

# {BTCUSDT: {symbol, price, open, high, low, change24h, volume}}
_prices: dict[str, dict] = {}

# FastAPI WebSocket clients waiting for live updates
_clients: set[WebSocket] = set()


# ─── Public helpers ───────────────────────────────────────────────────────────

def snapshot() -> list[dict]:
    """Return current price snapshot for all symbols (sorted by symbol)."""
    return sorted(_prices.values(), key=lambda x: x["symbol"])


def get_price(symbol: str) -> Optional[dict]:
    return _prices.get(symbol.upper())


def add_client(ws: WebSocket) -> None:
    _clients.add(ws)


def remove_client(ws: WebSocket) -> None:
    _clients.discard(ws)


# ─── Background tasks ─────────────────────────────────────────────────────────

async def _binance_listener(symbols: list[str]) -> None:
    """
    Connects to Binance combined miniTicker stream for all symbols.
    Writes price updates into _prices dict.
    Reconnects automatically on any error.
    """
    streams = "/".join(f"{s.lower()}@miniTicker" for s in symbols)
    url = f"{BINANCE_WS}?streams={streams}"

    while True:
        try:
            async with websockets.connect(
                url,
                ping_interval=20,
                ping_timeout=10,
                open_timeout=15,
            ) as ws:
                logger.info("Binance WS connected — tracking %d symbols", len(symbols))
                async for raw in ws:
                    try:
                        data = json.loads(raw)
                        p = data.get("data", {})
                        sym = p.get("s")
                        if not sym:
                            continue
                        _prices[sym] = {
                            "symbol":    sym,
                            "price":     float(p["c"]),   # last close
                            "open":      float(p["o"]),   # 24h open
                            "high":      float(p["h"]),   # 24h high
                            "low":       float(p["l"]),   # 24h low
                            "change24h": float(p["P"]),   # 24h % change
                            "volume":    float(p["q"]),   # 24h quote volume (USDT)
                        }
                    except Exception:
                        pass  # skip malformed message

        except Exception as e:
            logger.warning("Binance WS disconnected: %s — reconnecting in 5s", e)
            await asyncio.sleep(5)


async def _broadcast_loop() -> None:
    """
    Every second: sends the full price snapshot to all connected FastAPI WS clients.
    Dead connections are cleaned up automatically.
    """
    while True:
        await asyncio.sleep(1)

        if not _clients or not _prices:
            continue

        msg = json.dumps({"type": "prices", "data": snapshot()})
        dead: set[WebSocket] = set()

        for client in list(_clients):
            try:
                await client.send_text(msg)
            except Exception:
                dead.add(client)

        _clients.difference_update(dead)


async def start(symbols: list[str]) -> list[asyncio.Task]:
    """Start both background tasks. Returns tasks so lifespan can cancel them."""
    return [
        asyncio.create_task(_binance_listener(symbols)),
        asyncio.create_task(_broadcast_loop()),
    ]
