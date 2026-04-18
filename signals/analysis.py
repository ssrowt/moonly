"""
Technical analysis: H1 trend (SMA), M15 FVG, Order Block, RSI, momentum.
"""
from typing import List, Optional, Dict

# Candle indices
I_TS, I_O, I_H, I_L, I_C, I_V = 0, 1, 2, 3, 4, 5


# ─── H1 Trend ─────────────────────────────────────────────────────────────────

def sma(values: List[float], period: int) -> float:
    return sum(values[-period:]) / period

def get_h1_trend(candles: List[List[float]]) -> Dict:
    closes = [c[I_C] for c in candles]
    if len(closes) < 50:
        return {"trend": "SIDEWAYS", "sma20": 0, "sma50": 0, "is_sideways": True}

    sma20 = sma(closes, 20)
    sma50 = sma(closes, 50)
    current = closes[-1]
    is_sideways = abs(sma20 - sma50) / current < 0.002

    if is_sideways:
        trend = "SIDEWAYS"
    elif sma20 > sma50:
        trend = "UP"
    else:
        trend = "DOWN"

    return {"trend": trend, "sma20": sma20, "sma50": sma50, "is_sideways": is_sideways}


# ─── RSI ──────────────────────────────────────────────────────────────────────

def calc_rsi(candles: List[List[float]], period: int = 14) -> float:
    closes = [c[I_C] for c in candles]
    if len(closes) < period + 1:
        return 50.0
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains = [max(d, 0) for d in deltas[-period:]]
    losses = [max(-d, 0) for d in deltas[-period:]]
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - 100 / (1 + rs), 2)


# ─── Momentum ─────────────────────────────────────────────────────────────────

def calc_momentum(candles: List[List[float]], n: int = 5) -> float:
    """% change over last n M15 candles."""
    if len(candles) < n + 1:
        return 0.0
    old = candles[-n - 1][I_C]
    new = candles[-1][I_C]
    if old == 0:
        return 0.0
    return (new - old) / old * 100


# ─── FVG (Fair Value Gap) ─────────────────────────────────────────────────────

def find_fvg(candles: List[List[float]], direction: str, lookback: int = 60) -> Optional[Dict]:
    """
    Bullish FVG: candle[i+2].low > candle[i].high  → gap between i and i+2
    Bearish FVG: candle[i+2].high < candle[i].low

    Returns most recent valid FVG close to current price.
    """
    current = candles[-1][I_C]
    window = candles[-lookback - 3:-1] if len(candles) > lookback + 3 else candles[:-1]

    best = None
    for i in range(len(window) - 2):
        c0, c1, c2 = window[i], window[i + 1], window[i + 2]
        if direction == "BUY":
            if c2[I_L] > c0[I_H]:
                zone_low, zone_high = c0[I_H], c2[I_L]
                mid = (zone_low + zone_high) / 2
                dist = abs(current - mid) / current
                if dist <= 0.015:
                    if best is None or i > best["_idx"]:
                        best = {
                            "type": "bullish_fvg",
                            "low": zone_low,
                            "high": zone_high,
                            "ts": c1[I_TS],
                            "_idx": i,
                            "_dist": dist,
                        }
        else:  # SELL
            if c2[I_H] < c0[I_L]:
                zone_low, zone_high = c2[I_H], c0[I_L]
                mid = (zone_low + zone_high) / 2
                dist = abs(current - mid) / current
                if dist <= 0.015:
                    if best is None or i > best["_idx"]:
                        best = {
                            "type": "bearish_fvg",
                            "low": zone_low,
                            "high": zone_high,
                            "ts": c1[I_TS],
                            "_idx": i,
                            "_dist": dist,
                        }
    return best


# ─── Order Block ──────────────────────────────────────────────────────────────

def find_order_block(candles: List[List[float]], direction: str, lookback: int = 60, impulse_pct: float = 0.006) -> Optional[Dict]:
    """
    Bullish OB: last bearish candle before a strong upward impulse (≥0.6% over 2-4 candles).
    Bearish OB: last bullish candle before a strong downward impulse.
    """
    current = candles[-1][I_C]
    window = candles[-lookback - 4:] if len(candles) > lookback + 4 else candles

    best = None
    for i in range(len(window) - 4):
        c = window[i]
        if direction == "BUY":
            # Bearish candle (close < open)
            if c[I_C] >= c[I_O]:
                continue
            # Check impulse over next 2-4 candles
            for j in range(2, 5):
                if i + j >= len(window):
                    break
                impulse = (window[i + j][I_C] - c[I_C]) / c[I_C]
                if impulse >= impulse_pct:
                    zone_low, zone_high = c[I_L], c[I_H]
                    mid = (zone_low + zone_high) / 2
                    dist = abs(current - mid) / current
                    if dist <= 0.015:
                        if best is None or i > best["_idx"]:
                            best = {
                                "type": "bullish_ob",
                                "low": zone_low,
                                "high": zone_high,
                                "ts": c[I_TS],
                                "_idx": i,
                                "_dist": dist,
                            }
                    break
        else:  # SELL
            # Bullish candle (close > open)
            if c[I_C] <= c[I_O]:
                continue
            for j in range(2, 5):
                if i + j >= len(window):
                    break
                impulse = (c[I_C] - window[i + j][I_C]) / c[I_C]
                if impulse >= impulse_pct:
                    zone_low, zone_high = c[I_L], c[I_H]
                    mid = (zone_low + zone_high) / 2
                    dist = abs(current - mid) / current
                    if dist <= 0.015:
                        if best is None or i > best["_idx"]:
                            best = {
                                "type": "bearish_ob",
                                "low": zone_low,
                                "high": zone_high,
                                "ts": c[I_TS],
                                "_idx": i,
                                "_dist": dist,
                            }
                    break
    return best
