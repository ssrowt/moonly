import { useEffect, useState, useCallback } from 'react';
import { api } from '../../utils/api';
import { hapticFeedback } from '../../utils/telegram';
import { useLang } from '../../i18n/LangContext';
import type { LiveSignal } from '../../types';
import './Signals.css';

export default function SignalsList() {
  const { T, lang } = useLang();
  const [signals, setSignals] = useState<LiveSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const d = await api.get<{ signals: LiveSignal[] }>('/api/signals/live');
      setSignals(d.signals);
      setLastUpdated(new Date());
    } catch {
      setError(T.failed_signals);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [T]);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const handleRefresh = () => {
    hapticFeedback('light');
    load(true);
  };

  if (loading) return (
    <div className="page">
      <div className="state-center"><div className="spinner" /></div>
    </div>
  );

  if (error) return (
    <div className="page">
      <div className="state-center">
        <span style={{ fontSize: 36 }}>⚠️</span>
        <p style={{ fontSize: 14 }}>{error}</p>
        <button className="btn-refresh" onClick={handleRefresh}>{T.refresh}</button>
      </div>
    </div>
  );

  const locale = lang === 'ru' ? 'ru-RU' : 'en-US';

  return (
    <div className="page">
      <div className="signals-subheader">
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>{T.signals}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastUpdated && (
            <span className="signals-count">
              {lastUpdated.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            className="btn-refresh"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? '…' : T.refresh}
          </button>
        </div>
      </div>

      {signals.length === 0 ? (
        <div className="state-center">
          <span style={{ fontSize: 36 }}>📭</span>
          <p>{T.no_signals}</p>
        </div>
      ) : (
        <div className="signals-list">
          {signals.map((signal, i) => (
            <LiveSignalCard key={`${signal.symbol}-${i}`} signal={signal} T={T} />
          ))}
        </div>
      )}
    </div>
  );
}

function LiveSignalCard({ signal, T }: { signal: LiveSignal; T: any }) {
  const isBuy = signal.trend === 'BUY';
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`card signal-card signal-card--${isBuy ? 'bullish' : 'bearish'}`}
      onClick={() => { hapticFeedback('light'); setExpanded(e => !e); }}
    >
      {/* Top row */}
      <div className="signal-card__top">
        <span className="signal-card__symbol">{signal.symbol}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {signal.is_top && (
            <span className="badge badge-fresh">{T.fresh}</span>
          )}
          {signal.is_risky && (
            <span className="badge badge-risk">{T.risk_trade}</span>
          )}
          <span className={`badge ${isBuy ? 'badge-bullish' : 'badge-bearish'}`}>
            {isBuy ? '▲' : '▼'} {isBuy ? T.buy : T.sell}
          </span>
          <span className="signal-card__expand">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Price levels — always visible */}
      <div className="live-levels">
        <div className="live-level">
          <span className="level-label">{T.entry}</span>
          <span className="level-value level-entry">{formatPrice(signal.entry)}</span>
        </div>
        <div className="live-level">
          <span className="level-label">TP</span>
          <span className="level-value level-tp">{formatPrice(signal.tp)}</span>
        </div>
        <div className="live-level">
          <span className="level-label">SL</span>
          <span className="level-value level-sl">{formatPrice(signal.sl)}</span>
        </div>
      </div>

      {/* Stats + Analysis — shown on expand */}
      {expanded && (
        <>
          <div className="live-stats">
            <div className="live-stat">
              <span className="live-stat__label">{T.winrate}</span>
              <span className="live-stat__value">{signal.winrate}%</span>
            </div>
            <div className="live-stat">
              <span className="live-stat__label">{T.score}</span>
              <span className="live-stat__value">{signal.score}</span>
            </div>
            <div className="live-stat">
              <span className="live-stat__label">RSI</span>
              <span className="live-stat__value">{signal.rsi}</span>
            </div>
            <div className="live-stat">
              <span className="live-stat__label">{lang === 'ru' ? 'Тренд' : 'Trend'}</span>
              <span className={`live-stat__value ${isBuy ? 'level-tp' : 'level-sl'}`}>
                {isBuy ? T.trend_up : T.trend_down}
              </span>
            </div>
          </div>

          {signal.is_risky && (
            <div className="risk-warning">
              {lang === 'ru'
                ? '⚠️ Сигнал не соответствует всем строгим параметрам. RSI или FVG ретест ослаблены — торговля несёт повышенный риск.'
                : '⚠️ Signal does not meet all strict parameters. RSI or FVG retest is relaxed — trading carries elevated risk.'}
            </div>
          )}

          {signal.ai_analysis && (
            <div className="live-analysis">
              <span className="live-analysis__label">{T.ai_analysis}</span>
              <p className="live-analysis__text">{signal.ai_analysis}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
}
