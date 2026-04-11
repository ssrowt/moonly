"""
OKX data source (public, no API key required, cloud-friendly).
Fetches OHLCV klines from OKX v5 market API.
"""

import asyncio
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

OKX_BASE = "https://www.okx.com"

TOP_40_SYMBOLS = [
    "BTCUSDT",   "ETHUSDT",   "BNBUSDT",   "SOLUSDT",   "XRPUSDT",
    "DOGEUSDT",  "ADAUSDT",   "AVAXUSDT",  "DOTUSDT",   "LINKUSDT",
    "MATICUSDT", "LTCUSDT",   "UNIUSDT",   "ATOMUSDT",  "ETCUSDT",
    "XLMUSDT",   "NEARUSDT",  "APTUSDT",   "OPUSDT",    "ARBUSDT",
    "INJUSDT",   "RUNEUSDT",  "SUIUSDT",   "SEIUSDT",   "TIAUSDT",
    "WLDUSDT",   "FETUSDT",   "RENDERUSDT","IMXUSDT",   "GALAUSDT",
    "SANDUSDT",  "MANAUSDT",  "AXSUSDT",   "HBARUSDT",  "ALGOUSDT",
    "FLOWUSDT",  "APEUSDT",   "GMTUSDT",   "FTMUSDT",   "SHIBUSDT",
]


def _to_okx(symbol: str) -> str:
    """Convert BTCUSDT → BTC-USDT for OKX instId format."""
    base = symbol.replace("USDT", "")
    return f"{base}-USDT"


async def get_klines(
    client: httpx.AsyncClient,
    symbol: str,
    interval: str = "15m",
    limit: int = 120,
) -> Optional[list[dict]]:
    """
    Fetch OHLCV candles from OKX v5.
    OKX returns newest-first — we reverse to oldest-first for the algorithm.
    Response: [ts, open, high, low, close, vol, volCcy, volCcyQuote, confirm]
    """
    try:
        resp = await client.get(
            f"{OKX_BASE}/api/v5/market/candles",
            params={
                "instId": _to_okx(symbol),
                "bar":    interval,
                "limit":  limit,
            },
            timeout=10.0,
        )
        resp.raise_for_status()
        body = resp.json()

        if body.get("code") != "0":
            logger.warning("OKX error for %s: %s", symbol, body.get("msg"))
            return None

        raw = body.get("data", [])
        if len(raw) < 50:
            return None

        # OKX returns newest first — reverse to oldest first
        raw = list(reversed(raw))

        return [
            {
                "open":   float(c[1]),
                "high":   float(c[2]),
                "low":    float(c[3]),
                "close":  float(c[4]),
                "volume": float(c[5]),
            }
            for c in raw
        ]
    except httpx.HTTPStatusError as e:
        logger.warning("OKX HTTP error for %s: %s", symbol, e.response.status_code)
        return None
    except Exception as e:
        logger.warning("OKX fetch error for %s: %s", symbol, e)
        return None


async def fetch_all_candles(
    symbols: list[str] = TOP_40_SYMBOLS,
    interval: str = "15m",
    limit: int = 120,
) -> dict[str, list[dict]]:
    """
    Fetch candles for all symbols concurrently.
    Returns {symbol: candles} with only successful results.
    """
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            *[get_klines(client, sym, interval, limit) for sym in symbols],
            return_exceptions=False,
        )
    return {
        sym: candles
        for sym, candles in zip(symbols, results)
        if candles is not None
    }
