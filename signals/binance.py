"""
Bybit data source (replaces Binance).
Fetches OHLCV klines from Bybit v5 public API — no API key required.
"""

import asyncio
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

BYBIT_BASE = "https://api.bybit.com"

TOP_40_SYMBOLS = [
    "BTCUSDT",   "ETHUSDT",   "BNBUSDT",   "SOLUSDT",   "XRPUSDT",
    "DOGEUSDT",  "ADAUSDT",   "AVAXUSDT",  "DOTUSDT",   "LINKUSDT",
    "MATICUSDT", "LTCUSDT",   "UNIUSDT",   "ATOMUSDT",  "ETCUSDT",
    "XLMUSDT",   "NEARUSDT",  "APTUSDT",   "OPUSDT",    "ARBUSDT",
    "INJUSDT",   "RUNEUSDT",  "SUIUSDT",   "SEIUSDT",   "TIAUSDT",
    "WLDUSDT",   "FETUSDT",   "RENDERUSDT","IMXUSDT",   "GALAUSDT",
    "SANDUSDT",  "MANAUSDT",  "AXSUSDT",   "HBARUSDT",  "ALGOUSDT",
    "FLOWUSDT",  "APEUSDT",   "GMTUSDT",   "FTMUSDT",   "1000SHIBUSDT",
]


async def get_klines(
    client: httpx.AsyncClient,
    symbol: str,
    interval: str = "15",
    limit: int = 120,
) -> Optional[list[dict]]:
    """
    Fetch OHLCV candles from Bybit v5.
    Bybit returns newest-first — we reverse to oldest-first for the algorithm.
    """
    try:
        resp = await client.get(
            f"{BYBIT_BASE}/v5/market/kline",
            params={
                "category": "linear",
                "symbol":   symbol,
                "interval": interval,
                "limit":    limit,
            },
            timeout=10.0,
        )
        resp.raise_for_status()
        body = resp.json()

        if body.get("retCode") != 0:
            logger.warning("Bybit error for %s: %s", symbol, body.get("retMsg"))
            return None

        raw = body["result"]["list"]  # [[time, open, high, low, close, volume, turnover], ...]
        if len(raw) < 50:
            return None

        # Bybit returns newest first — reverse to oldest first
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
        logger.warning("Bybit HTTP error for %s: %s", symbol, e.response.status_code)
        return None
    except Exception as e:
        logger.warning("Bybit fetch error for %s: %s", symbol, e)
        return None


async def fetch_all_candles(
    symbols: list[str] = TOP_40_SYMBOLS,
    interval: str = "15",
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
