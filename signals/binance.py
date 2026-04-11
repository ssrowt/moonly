import asyncio
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

BINANCE_BASE = "https://api.binance.com"

TOP_40_SYMBOLS = [
    "BTCUSDT",  "ETHUSDT",  "BNBUSDT",  "SOLUSDT",  "XRPUSDT",
    "DOGEUSDT", "ADAUSDT",  "AVAXUSDT", "DOTUSDT",  "LINKUSDT",
    "MATICUSDT","LTCUSDT",  "UNIUSDT",  "ATOMUSDT", "ETCUSDT",
    "XLMUSDT",  "NEARUSDT", "APTUSDT",  "OPUSDT",   "ARBUSDT",
    "INJUSDT",  "RUNEUSDT", "SUIUSDT",  "SEIUSDT",  "TIAUSDT",
    "WLDUSDT",  "FETUSDT",  "RENDERUSDT","IMXUSDT", "GALAUSDT",
    "SANDUSDT", "MANAUSDT", "AXSUSDT",  "HBARUSDT", "ALGOUSDT",
    "FLOWUSDT", "APEUSDT",  "GMTUSDT",  "FTMUSDT",  "1000SHIBUSDT",
]


async def get_klines(
    client: httpx.AsyncClient,
    symbol: str,
    interval: str = "15m",
    limit: int = 120,
) -> Optional[list[dict]]:
    """Fetch OHLCV candles from Binance. Returns list of dicts or None on error."""
    try:
        resp = await client.get(
            f"{BINANCE_BASE}/api/v3/klines",
            params={"symbol": symbol, "interval": interval, "limit": limit},
            timeout=10.0,
        )
        resp.raise_for_status()
        raw = resp.json()
        if len(raw) < 50:
            return None
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
        logger.warning("Binance HTTP error for %s: %s", symbol, e.response.status_code)
        return None
    except Exception as e:
        logger.warning("Binance fetch error for %s: %s", symbol, e)
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
