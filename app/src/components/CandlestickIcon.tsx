export default function CandlestickIcon() {
  return (
    <svg viewBox="0 0 40 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Candle 1 — bearish (dark) */}
      <line x1="7" y1="2"  x2="7"  y2="7"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="3" y="7"  width="8" height="14" rx="1.5" fill="currentColor" fillOpacity="0.9" />
      <line x1="7" y1="21" x2="7"  y2="26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

      {/* Candle 2 — bearish small (dark) */}
      <line x1="17" y1="14" x2="17" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="13" y="18" width="8" height="9"  rx="1.5" fill="currentColor" fillOpacity="0.9" />
      <line x1="17" y1="27" x2="17" y2="30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

      {/* Candle 3 — bullish (bright) */}
      <line x1="27" y1="6"  x2="27" y2="11" stroke="#7ab8e8" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="23" y="11" width="8" height="13" rx="1.5" fill="#5b9bd5" />
      <line x1="27" y1="24" x2="27" y2="29" stroke="#7ab8e8" strokeWidth="1.5" strokeLinecap="round" />

      {/* Candle 4 — bullish tall (bright) */}
      <line x1="37" y1="2"  x2="37" y2="7"  stroke="#7ab8e8" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="33" y="7"  width="8" height="18" rx="1.5" fill="#5b9bd5" />
      <line x1="37" y1="25" x2="37" y2="30" stroke="#7ab8e8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
