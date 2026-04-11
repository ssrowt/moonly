"""
Live price streaming via Bybit WebSocket v5 public tickers.

Architecture:
  _bybit_listener()   — connects to Bybit WS, writes updates to _prices dict
  _broadcast_loop()   — every second, pushes full snapshot to connected clients
  REST GET /prices    — instant snapshot from cache (no WS required by clients)
  WS  /ws/prices      — push-based: sends snapshot every second to connected clients
"""

import asyncio
import json
import logging
from typing import Optional

import websockets
from fastapi import WebSocket

logger = logging.getLogger("moonly.prices")

BYBIT_WS = "wss://stream.bybit.com/v5/public/linear"

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

async def _bybit_listener(symbols: list[str]) -> None:
    """
    Connects to Bybit v5 public linear WebSocket.
    Subscribes to tickers for all symbols, writes updates into _prices dict.
    Reconnects automatically on any error.
    """
    args = [f"tickers.{s}" for s in symbols]

    while True:
        try:
            async with websockets.connect(
                BYBIT_WS,
                ping_interval=20,
                ping_timeout=10,
                open_timeout=15,
            ) as ws:
                # Subscribe to all tickers in one message
                await ws.send(json.dumps({"op": "subscribe", "args": args}))
                logger.info("Bybit WS connected — tracking %d symbols", len(symbols))

                async for raw in ws:
                    try:
                        msg = json.loads(raw)

                        # Skip subscription confirmations and heartbeats
                        if "topic" not in msg:
                            continue

                        data = msg.get("data", {})
                        sym = data.get("symbol")
                        if not sym:
                            continue

                        # For delta messages, only update fields that are present
                        entry = _prices.get(sym, {"symbol": sym})

                        if "lastPrice" in data:
                            entry["price"] = float(data["lastPrice"])
                        if "highPrice24h" in data:
                            entry["high"] = float(data["highPrice24h"])
                        if "lowPrice24h" in data:
                            entry["low"] = float(data["lowPrice24h"])
                        if "prevPrice24h" in data:
                            entry["open"] = float(data["prevPrice24h"])
                        if "price24hPcnt" in data:
                            entry["change24h"] = float(data["price24hPcnt"]) * 100
                        if "turnover24h" in data:
                            entry["volume"] = float(data["turnover24h"])

                        entry["symbol"] = sym
                        _prices[sym] = entry

                    except Exception:
                        pass  # skip malformed message

        except Exception as e:
            logger.warning("Bybit WS disconnected: %s — reconnecting in 5s", e)
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
        asyncio.create_task(_bybit_listener(symbols)),
        asyncio.create_task(_broadcast_loop()),
    ]
