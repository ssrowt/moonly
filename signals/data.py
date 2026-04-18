"""
OKX candle data fetching for Moonly signals.
Fetches H1 and M15 candles for 40 symbols concurrently.
"""
import asyncio
import logging
import httpx
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger("moonly.data")

TOP_40_SYMBOLS = [
    "BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT",
    "ADAUSDT","DOGEUSDT","AVAXUSDT","LINKUSDT","DOTUSDT",
    "TRXUSDT","LTCUSDT","BCHUSDT","APTUSDT","NEARUSDT",
    "ARBUSDT","OPUSDT","SUIUSDT","TONUSDT","MATICUSDT",
    "ATOMUSDT","FILUSDT","INJUSDT","ETCUSDT","ICPUSDT",
    "RUNEUSDT","FTMUSDT","ALGOUSDT","VETUSDT","GALAUSDT",
    "SANDUSDT","MANAUSDT","AXSUSDT","CHZUSDT","EGLDUSDT",
    "FLOWUSDT","KAVAUSDT","ZILUSDT","THETAUSDT","XTZUSDT",
]

OKX_BASE = "https://www.okx.com/api/v5/market/candles"

def _to_okx(symbol: str) -> str:
    base = symbol.replace("USDT", "")
    return f"{base}-USDT"

def _parse_candles(raw: list) -> List[List[float]]:
    """Parse OKX candle data: [[ts,o,h,l,c,vol,...], ...] newest-first → reverse."""
    result = []
    for c in reversed(raw):
        try:
            result.append([
                int(c[0]),      # timestamp ms
                float(c[1]),    # open
                float(c[2]),    # high
                float(c[3]),    # low
                float(c[4]),    # close
                float(c[5]),    # volume
            ])
        except (IndexError, ValueError):
            continue
    return result

async def fetch_candles(
    client: httpx.AsyncClient,
    symbol: str,
    bar: str,
    limit: int = 100,
) -> Optional[List[List[float]]]:
    inst_id = _to_okx(symbol)
    try:
        resp = await client.get(
            OKX_BASE,
            params={"instId": inst_id, "bar": bar, "limit": limit},
            timeout=10.0,
        )
        data = resp.json()
        if data.get("code") != "0" or not data.get("data"):
            logger.warning("OKX %s %s: code=%s", symbol, bar, data.get("code"))
            return None
        candles = _parse_candles(data["data"])
        return candles if len(candles) >= 20 else None
    except Exception as exc:
        logger.warning("OKX fetch error %s %s: %s", symbol, bar, exc)
        return None

async def fetch_all(symbols: List[str]) -> Dict[str, Tuple[Optional[list], Optional[list]]]:
    """
    Returns dict: symbol -> (h1_candles, m15_candles)
    h1: 100 candles (need 50 for SMA50)
    m15: 120 candles (for FVG/OB + RSI14)
    """
    sem = asyncio.Semaphore(8)

    async def _fetch_pair(client: httpx.AsyncClient, sym: str):
        async with sem:
            h1 = await fetch_candles(client, sym, "1H", 100)
            await asyncio.sleep(0.05)
            m15 = await fetch_candles(client, sym, "15m", 120)
            return sym, h1, m15

    async with httpx.AsyncClient() as client:
        tasks = [_fetch_pair(client, sym) for sym in symbols]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    out: Dict[str, Tuple] = {}
    for r in results:
        if isinstance(r, Exception):
            continue
        sym, h1, m15 = r
        out[sym] = (h1, m15)
    return out
