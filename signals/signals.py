"""
Signal generation: combines H1 trend + M15 zones → signal with entry, SL, TP, score.
"""
import logging
from typing import List, Optional, Dict
from analysis import get_h1_trend, find_fvg, find_order_block, calc_rsi, calc_momentum

logger = logging.getLogger("moonly.signals")

I_C = 4  # close index


def _calc_winrate(score: int) -> int:
    """Score → realistic winrate 45-70%."""
    base = 47
    rate = base + (score - 5) * 2.5
    return int(max(45, min(70, rate)))


def _make_analysis(direction: str, h1_trend: str, fvg, ob, rsi: float) -> str:
    zones = []
    if fvg:
        zones.append("FVG")
    if ob:
        zones.append("OB")
    zone_str = " + ".join(zones) if zones else "zone"
    rsi_str = "RSI supportive" if (direction == "BUY" and rsi < 45) or (direction == "SELL" and rsi > 55) else f"RSI {rsi:.0f}"
    confluence = "confluence " if fvg and ob else ""
    return f"H1 trend {h1_trend}, {direction} {confluence}{zone_str} retest, {rsi_str}."


def generate_signal(symbol: str, h1_candles: List, m15_candles: List) -> Optional[Dict]:
    try:
        return _generate(symbol, h1_candles, m15_candles)
    except Exception as exc:
        logger.warning("Signal error [%s]: %s", symbol, exc)
        return None


def _generate(symbol: str, h1_candles: List, m15_candles: List) -> Optional[Dict]:
    # ── H1 trend ──────────────────────────────────────────────────────────────
    h1 = get_h1_trend(h1_candles)
    if h1["is_sideways"]:
        return None

    direction = "BUY" if h1["trend"] == "UP" else "SELL"
    current_price = m15_candles[-1][I_C]

    # ── M15 zones ─────────────────────────────────────────────────────────────
    fvg = find_fvg(m15_candles, direction)
    ob = find_order_block(m15_candles, direction)

    if not fvg and not ob:
        return None

    # ── Best zone ─────────────────────────────────────────────────────────────
    if fvg and ob:
        # Try overlap (confluence)
        ol_low = max(fvg["low"], ob["low"])
        ol_high = min(fvg["high"], ob["high"])
        if ol_low < ol_high:
            zone_low, zone_high = ol_low, ol_high
            zone_type = "confluence_fvg_ob"
        else:
            # Average the two zones
            zone_low = (fvg["low"] + ob["low"]) / 2
            zone_high = (fvg["high"] + ob["high"]) / 2
            zone_type = "fvg_ob"
    elif fvg:
        zone_low, zone_high = fvg["low"], fvg["high"]
        zone_type = fvg["type"]
    else:
        zone_low, zone_high = ob["low"], ob["high"]
        zone_type = ob["type"]

    # Zone must be valid
    if zone_low >= zone_high:
        return None

    # ── Retest check ──────────────────────────────────────────────────────────
    zone_mid = (zone_low + zone_high) / 2
    dist = abs(current_price - zone_mid) / current_price
    if dist > 0.015:
        return None

    # Price must not have blown through the zone
    if direction == "BUY" and current_price < zone_low * 0.99:
        return None
    if direction == "SELL" and current_price > zone_high * 1.01:
        return None

    # ── Entry / SL / TP ───────────────────────────────────────────────────────
    entry = zone_mid
    buffer = (zone_high - zone_low) * 0.15

    if direction == "BUY":
        sl = zone_low - buffer
        risk = entry - sl
        tp = entry + risk * 2
    else:
        sl = zone_high + buffer
        risk = sl - entry
        tp = entry - risk * 2

    if risk <= 0:
        return None

    rr = risk * 2 / risk  # always 2.0 exactly
    # Sanity-check tp direction
    if direction == "BUY" and tp <= entry:
        return None
    if direction == "SELL" and tp >= entry:
        return None

    # ── RSI + Momentum ────────────────────────────────────────────────────────
    rsi = calc_rsi(m15_candles)
    momentum = calc_momentum(m15_candles)

    # ── Score ─────────────────────────────────────────────────────────────────
    score = 0
    score += 2  # H1 trend matches (always)
    score += 1  # no sideways (always)
    if fvg:
        score += 2
    if ob:
        score += 2
    if fvg and ob:
        score += 1  # confluence bonus

    # Retest quality
    if dist < 0.005:
        score += 1

    # RSI
    if (direction == "BUY" and rsi < 45) or (direction == "SELL" and rsi > 55):
        score += 1

    # Momentum aligned
    if (direction == "BUY" and momentum > 0) or (direction == "SELL" and momentum < 0):
        score += 1

    is_top = score >= 9
    winrate = _calc_winrate(score)
    analysis = _make_analysis(direction, h1["trend"], fvg, ob, rsi)

    # is_risky: true if not all strict conditions met (for frontend badge)
    rsi_strict = (direction == "BUY" and rsi < 45) or (direction == "SELL" and rsi > 55)
    is_risky = not (fvg and ob and rsi_strict)

    def fmt(v: float) -> float:
        if v > 1000:
            return round(v, 2)
        if v > 1:
            return round(v, 4)
        return round(v, 6)

    return {
        "symbol": symbol,
        "signal": direction,
        "trend": direction,           # frontend compat
        "current_price": fmt(current_price),
        "price": fmt(current_price),  # frontend compat
        "h1_trend": h1["trend"],
        "zone_type": zone_type,
        "entry_zone": [fmt(zone_low), fmt(zone_high)],
        "entry": fmt(entry),
        "tp": fmt(tp),
        "sl": fmt(sl),
        "rr": 2.0,
        "score": score,
        "winrate": winrate,
        "is_top": is_top,
        "is_fresh": True,
        "is_risky": is_risky,
        "rsi": rsi,
        "analysis": analysis,
        "ai_analysis": analysis,      # frontend compat
    }


def filter_for_plan(signals: List[Dict], plan: str) -> List[Dict]:
    """
    FREE   → first 3 signals
    PRO    → all signals
    DELUXE → all signals (same as PRO, different duration)
    """
    plan = plan.lower()
    if plan == "free":
        return signals[:3]
    return signals  # pro and deluxe get everything
