"""
Live price streaming via OKX WebSocket v5 public tickers.
"""

import asyncio
import json
import logging
from typing import Optional

import websockets
from fastapi import WebSocket

logger = logging.getLogger("moonly.prices")

OKX_WS = "wss://ws.okx.com:8443/ws/v5/public"


# ─── Shared state ─────────────────────────────────────────────────────────────

_prices: dict[str, dict] = {}
_clients: set[WebSocket] = set()


# ─── Public helpers ───────────────────────────────────────────────────────────

def snapshot() -> list[dict]:
    return sorted(_prices.values(), key=lambda x: x["symbol"])


def get_price(symbol: str) -> Optional[dict]:
    return _prices.get(symbol.upper())


def add_client(ws: WebSocket) -> None:
    _clients.add(ws)


def remove_client(ws: WebSocket) -> None:
    _clients.discard(ws)


def _to_okx(symbol: str) -> str:
    base = symbol.replace("USDT", "")
    return f"{base}-USDT"


# ─── Background tasks ─────────────────────────────────────────────────────────

async def _okx_listener(symbols: list[str]) -> None:
    """
    Connects to OKX v5 public WebSocket.
    Subscribes to tickers for all symbols.
    """
    args = [{"channel": "tickers", "instId": _to_okx(s)} for s in symbols]

    while True:
        try:
            async with websockets.connect(
                OKX_WS,
                ping_interval=20,
                ping_timeout=10,
                open_timeout=15,
            ) as ws:
                await ws.send(json.dumps({"op": "subscribe", "args": args}))
                logger.info("OKX WS connected — tracking %d symbols", len(symbols))

                async for raw in ws:
                    try:
                        msg = json.loads(raw)

                        if msg.get("event"):   # subscribe confirmation / error
                            continue

                        data_list = msg.get("data")
                        if not data_list:
                            continue

                        for data in data_list:
                            inst_id = data.get("instId", "")
                            if not inst_id.endswith("-USDT"):
                                continue

                            sym = inst_id.replace("-", "")   # BTC-USDT → BTCUSDT
                            _prices[sym] = {
                                "symbol":    sym,
                                "price":     float(data.get("last", 0)),
                                "open":      float(data.get("open24h", 0)),
                                "high":      float(data.get("high24h", 0)),
                                "low":       float(data.get("low24h", 0)),
                                "change24h": float(data.get("sodUtc8", 0)),
                                "volume":    float(data.get("volCcy24h", 0)),
                            }
                    except Exception:
                        pass

        except Exception as e:
            logger.warning("OKX WS disconnected: %s — reconnecting in 5s", e)
            await asyncio.sleep(5)


async def _broadcast_loop() -> None:
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
    return [
        asyncio.create_task(_okx_listener(symbols)),
        asyncio.create_task(_broadcast_loop()),
    ]
