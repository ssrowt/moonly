"""
Signal generation logic for Moonly.

Score scale: 0–100 internally, divided by 10 for API output (0–10).
  trend    : 0 / 10 / 20 / 30
  impulse  : 0 / 15 / 25
  fvg      : 0 / 25
  rsi      : 0 / 10
  strength : 0 / 3 / 7 / 10

Winrate: min(90, 45 + internal_score * 0.5)
"""

import copy
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Technical indicators ──────────────────────────────────────────────────────

def _sma(closes: list[float], period: int) -> Optional[float]:
    if len(closes) < period:
        return None
    return sum(closes[-period:]) / period


def _rsi(closes: list[float], period: int = 14) -> Optional[float]:
    """Simple RSI (non-smoothed). Requires at least period+1 closes."""
    if len(closes) < period + 1:
        return None
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    recent = deltas[-period:]
    gains = [d for d in recent if d > 0]
    losses = [-d for d in recent if d < 0]
    avg_gain = sum(gains) / period if gains else 0.0
    avg_loss = sum(losses) / period if losses else 0.0
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - 100.0 / (1.0 + rs)


# ─── Signal components ─────────────────────────────────────────────────────────

def _trend(closes: list[float]) -> tuple[Optional[str], int]:
    """
    Returns (direction, score).
    direction: 'BUY' | 'SELL' | None
    score: 0, 10, 20, or 30
    """
    sma20 = _sma(closes, 20)
    sma50 = _sma(closes, 50)
    if sma20 is None or sma50 is None:
        return None, 0

    diff_pct = abs(sma20 - sma50) / sma50 * 100
    if diff_pct < 0.2:
        return None, 0   # sideways — ignore

    direction = "BUY" if sma20 > sma50 else "SELL"
    if diff_pct >= 1.0:
        score = 30
    elif diff_pct >= 0.5:
        score = 20
    else:
        score = 10
    return direction, score


def _impulse(candles: list[dict]) -> tuple[bool, int]:
    """
    5-candle momentum check.
    Returns (has_impulse, score 0/15/25).
    """
    if len(candles) < 6:
        return False, 0
    pct = abs(candles[-1]["close"] - candles[-6]["close"]) / candles[-6]["close"] * 100
    if pct < 0.5:
        return False, 0
    return True, (25 if pct >= 1.0 else 15)


def _fvg(candles: list[dict]) -> tuple[bool, Optional[str], float, float]:
    """
    Classic 3-candle Fair Value Gap.
    Bullish : candles[-1].low  > candles[-3].high  → gap zone = [c1.high, c3.low]
    Bearish : candles[-1].high < candles[-3].low   → gap zone = [c3.high, c1.low]
    Returns (has_fvg, direction, zone_low, zone_high).
    """
    if len(candles) < 3:
        return False, None, 0.0, 0.0
    c1, c3 = candles[-3], candles[-1]
    if c3["low"] > c1["high"]:
        return True, "BUY", c1["high"], c3["low"]
    if c3["high"] < c1["low"]:
        return True, "SELL", c3["high"], c1["low"]
    return False, None, 0.0, 0.0


def _retest_ok(price: float, zone_low: float, zone_high: float) -> bool:
    """
    Price must be within the FVG zone or no more than 2% from its midpoint.
    """
    if zone_low <= price <= zone_high:
        return True
    mid = (zone_low + zone_high) / 2
    return abs(price - mid) / mid * 100 <= 2.0


def _strength(candles: list[dict]) -> int:
    """Volume strength vs 20-candle average. Score: 0 / 3 / 7 / 10."""
    if len(candles) < 20:
        return 5
    recent_avg = sum(c["volume"] for c in candles[-5:]) / 5
    baseline   = sum(c["volume"] for c in candles[-20:]) / 20
    if baseline == 0:
        return 5
    ratio = recent_avg / baseline
    if ratio >= 1.5:
        return 10
    if ratio >= 1.0:
        return 7
    return 3


# ─── AI analysis text (DELUXE only) ──────────────────────────────────────────

def _ai_text(sig: dict) -> str:
    sym       = sig["symbol"].replace("USDT", "").replace("1000", "")
    direction = sig["trend"]
    rsi       = sig["rsi"]
    score     = sig["score"]
    entry     = sig["entry"]

    trend_word  = "восходящий" if direction == "BUY" else "нисходящий"
    rsi_state   = "перепродан" if rsi < 45 else "перекуплен"
    action      = "покупку" if direction == "BUY" else "продажу"
    strength    = "сильный" if score >= 8 else ("умеренный" if score >= 6 else "слабый")

    return (
        f"{sym}: {strength} сигнал на {action}. "
        f"Тренд {trend_word} (SMA20 / SMA50). "
        f"RSI {rsi:.1f} — {rsi_state}. "
        f"FVG зона [{entry:.6g}], ретест подтверждён. "
        f"TP: {sig['tp']:.6g} | SL: {sig['sl']:.6g}."
    )


# ─── Main signal generator ─────────────────────────────────────────────────────

def generate_signal(symbol: str, candles: list[dict]) -> Optional[dict]:
    """
    Two-tier signal pipeline:
      Strict  — all original conditions met → is_risky=False
      Relaxed — loosened RSI/retest conditions → is_risky=True (shown with risk warning)
      None    — doesn't meet even relaxed conditions → filtered out
    """
    if len(candles) < 120:
        return None

    closes        = [c["close"] for c in candles]
    current_price = closes[-1]

    # 1. Trend (required in both tiers)
    direction, trend_score = _trend(closes)
    if direction is None:
        return None

    # 2. Impulse (required in both tiers)
    has_impulse, impulse_score = _impulse(candles)
    if not has_impulse:
        return None

    # 3. FVG — optional but scored (bonus if present and direction matches)
    has_fvg, fvg_dir, zone_low, zone_high = _fvg(candles)
    fvg_aligned = has_fvg and fvg_dir == direction

    # 4. RSI filter
    rsi = _rsi(closes)
    if rsi is None:
        return None

    # Strict RSI thresholds
    rsi_strict = (direction == "BUY" and rsi < 45) or (direction == "SELL" and rsi > 55)
    # Relaxed RSI thresholds
    rsi_ok     = (direction == "BUY" and rsi < 65) or (direction == "SELL" and rsi > 35)
    if not rsi_ok:
        return None  # completely outside acceptable range

    # 5. Retest (only meaningful if FVG present)
    retest_ok = fvg_aligned and _retest_ok(current_price, zone_low, zone_high)

    # Determine risk level:
    # strict = FVG aligned + retest confirmed + RSI in strict zone
    # risky  = any of those conditions relaxed or absent
    is_risky = not (rsi_strict and fvg_aligned and retest_ok)

    # ─── Score (0–100 internally) ──────────────────────────────────────────────
    fvg_score = 25 if retest_ok else (12 if fvg_aligned else 0)
    rsi_score = 10 if rsi_strict else 5

    internal_score = (
        trend_score       # 0–30
        + impulse_score   # 0–25
        + fvg_score       # 0, 12, or 25
        + rsi_score       # 5 or 10
        + _strength(candles)  # 0–10
    )

    display_score = round(internal_score / 10, 1)   # 0–10
    if display_score < 5.0:
        return None

    # Risky signals get a winrate penalty
    winrate = min(90.0, round(45.0 + internal_score * 0.5, 1))
    if is_risky:
        winrate = round(winrate * 0.85, 1)

    # ─── Entry / TP / SL ──────────────────────────────────────────────────────
    if retest_ok:
        entry = round((zone_low + zone_high) / 2, 8)
    else:
        entry = round(current_price, 8)

    if direction == "BUY":
        sl = round(entry * 0.98, 8)
        tp = round(entry * 1.04, 8)
    else:
        sl = round(entry * 1.02, 8)
        tp = round(entry * 0.96, 8)

    return {
        "symbol":    symbol,
        "price":     round(current_price, 8),
        "entry":     entry,
        "tp":        tp,
        "sl":        sl,
        "score":     display_score,
        "winrate":   winrate,
        "trend":     direction,
        "rsi":       round(rsi, 2),
        "is_top":    display_score >= 8.0 and not is_risky,
        "is_risky":  is_risky,
        # ai_analysis filled only for deluxe in filter_for_plan()
    }


# ─── Plan-based filtering ─────────────────────────────────────────────────────

_PLAN_CONFIG: dict[str, dict] = {
    "free":   {"limit": 3,  "min": 5.0, "max": 7.9},
    "pro":    {"limit": 10, "min": 6.0, "max": 9.9},
    "deluxe": {"limit": 40, "min": 5.0, "max": 10.0},
}


def filter_for_plan(signals: list[dict], plan: str) -> list[dict]:
    """
    Filter and cap the signal list for a given subscription plan.
    Adds ai_analysis only for DELUXE; strips it for others.
    """
    cfg = _PLAN_CONFIG.get(plan, _PLAN_CONFIG["free"])

    filtered = [
        copy.copy(s) for s in signals
        if cfg["min"] <= s["score"] <= cfg["max"]
    ]

    # Top signals first, then by score
    filtered.sort(key=lambda s: (s["is_top"], s["score"]), reverse=True)
    result = filtered[: cfg["limit"]]

    for sig in result:
        if plan == "deluxe":
            sig["ai_analysis"] = _ai_text(sig)
        # no ai_analysis key for free/pro — keeps response lean

    return result
