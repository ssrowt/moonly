import { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { useLang } from '../../i18n/LangContext';
import type { MarketData, MarketCoin } from '../../types';
import './Home.css';

export default function Home() {
  const { T, lang } = useLang();
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get<MarketData>('/api/market')
      .then(d => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const locale = lang === 'ru' ? 'ru-RU' : 'en-US';

  return (
    <div className="page">
      {loading && (
        <div className="state-center" style={{ paddingTop: 40 }}>
          <div className="spinner" />
        </div>
      )}

      {error && (
        <div className="state-center">
          <span style={{ fontSize: 36 }}>📡</span>
          <p style={{ fontSize: 14 }}>{T.market_unavail}</p>
        </div>
      )}

      {data && data.coins?.length > 0 && data.btcChart && (
        <>
          <p className="section-title">{T.btc_chart}</p>
          <div className="card home-chart-card">
            <BtcChartHeader coin={data.coins[0]} />
            <div className="home-chart__svg">
              <Sparkline points={data.btcChart.map(p => p.price)} up={data.coins[0].change24h >= 0} />
            </div>
            <div className="home-chart__days">
              {getDayLabels(data.btcChart, locale).map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
          </div>

          <p className="section-title" style={{ marginTop: 20 }}>{T.top_coins}</p>
          <div className="home-coins">
            {data.coins.map(coin => (
              <CoinCard key={coin.id} coin={coin} />
            ))}
          </div>

          {data.stale && (
            <p className="home-stale">{T.cached} · {formatTime(data.updatedAt, locale)}</p>
          )}
          {!data.stale && (
            <p className="home-updated">{T.updated} {formatTime(data.updatedAt, locale)}</p>
          )}
        </>
      )}
    </div>
  );
}

function BtcChartHeader({ coin }: { coin: MarketCoin }) {
  const up = coin.change24h >= 0;
  return (
    <div className="home-chart__header">
      <div>
        <span className="home-chart__price">${formatPrice(coin.price)}</span>
        <span className={`home-chart__change ${up ? 'home-chart__change--up' : 'home-chart__change--down'}`}>
          {up ? '▲' : '▼'} {Math.abs(coin.change24h).toFixed(2)}%
        </span>
      </div>
      <span className="home-chart__period">24h</span>
    </div>
  );
}

function CoinCard({ coin }: { coin: MarketCoin }) {
  const up = coin.change24h >= 0;
  return (
    <div className="card coin-card">
      <div className="coin-card__icon">{coinSymbol(coin.symbol)}</div>
      <div className="coin-card__info">
        <span className="coin-card__symbol">{coin.symbol}</span>
        <span className="coin-card__name">{coin.name}</span>
      </div>
      <div className="coin-card__right">
        <span className="coin-card__price">${formatPrice(coin.price)}</span>
        <span className={`coin-card__change ${up ? 'coin-card__change--up' : 'coin-card__change--down'}`}>
          {up ? '+' : ''}{coin.change24h.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

function Sparkline({ points, up }: { points: number[]; up: boolean }) {
  if (points.length < 2) return null;
  const W = 300, H = 100, PAD = 10;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const color = up ? 'var(--bullish)' : 'var(--bearish)';

  const coords = points.map((p, i) => ({
    x: (i / (points.length - 1)) * W,
    y: H - PAD - ((p - min) / range) * (H - PAD * 2),
  }));

  let d = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
  for (let i = 1; i < coords.length; i++) {
    const cpx = ((coords[i - 1].x + coords[i].x) / 2).toFixed(1);
    d += ` C ${cpx},${coords[i - 1].y.toFixed(1)} ${cpx},${coords[i].y.toFixed(1)} ${coords[i].x.toFixed(1)},${coords[i].y.toFixed(1)}`;
  }

  const fillD = `${d} L ${W},${H} L 0,${H} Z`;
  const lastPt = coords[coords.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#sparkFill)" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPt.x} cy={lastPt.y} r="4" fill={color} />
      <circle cx={lastPt.x} cy={lastPt.y} r="8" fill={color} fillOpacity="0.2" />
    </svg>
  );
}

function coinSymbol(s: string) {
  const map: Record<string, string> = { BTC: '₿', ETH: 'Ξ', SOL: '◎' };
  return map[s] ?? s[0];
}

function formatPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(4);
}

function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function getDayLabels(chart: { ts: number }[], locale: string): string[] {
  return chart.map(p =>
    new Date(p.ts).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  );
}
