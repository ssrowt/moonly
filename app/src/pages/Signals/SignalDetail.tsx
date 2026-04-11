import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { hapticFeedback } from '../../utils/telegram';
import { useLang } from '../../i18n/LangContext';
import type { Signal } from '../../types';
import './Signals.css';

export default function SignalDetail() {
  const { T } = useLang();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [signal, setSignal] = useState<Signal | null>(null);
  const [loading, setLoading] = useState(true);
  const [planError, setPlanError] = useState(false);

  useEffect(() => {
    api.get<{ signal: Signal }>(`/api/signals/${id}`)
      .then(d => setSignal(d.signal))
      .catch(err => {
        if (err.status === 403) setPlanError(true);
        else navigate('/');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="page">
      <div className="state-center"><div className="spinner" /></div>
    </div>
  );

  if (planError) return (
    <div className="page">
      <button className="detail-back" onClick={() => navigate('/signals')}>{T.back}</button>
      <div className="state-center" style={{ paddingTop: 30 }}>
        <span style={{ fontSize: 44 }}>🔒</span>
        <h2>{T.premium_signal}</h2>
        <p style={{ fontSize: 14, color: 'var(--text-sec)' }}>{T.premium_desc}</p>
        <button className="btn btn-primary" style={{ marginTop: 8, maxWidth: 240 }} onClick={() => navigate('/profile')}>
          {T.view_plans}
        </button>
      </div>
    </div>
  );

  if (!signal) return null;

  const isBull = signal.direction === 'BULLISH';
  const tps = [
    { label: 'TP1', value: signal.take_profit_1 },
    { label: 'TP2', value: signal.take_profit_2 },
    { label: 'TP3', value: signal.take_profit_3 },
  ].filter(t => t.value != null) as { label: string; value: number }[];

  const confColor =
    signal.confidence_score >= 75 ? 'var(--bullish)' :
    signal.confidence_score >= 50 ? 'var(--warning)' :
    'var(--bearish)';

  return (
    <div className="page">
      <button className="detail-back" onClick={() => { hapticFeedback('light'); navigate('/signals'); }}>
        {T.back_signals}
      </button>

      {/* Hero */}
      <div className="detail-hero">
        <div className="detail-symbol">{signal.symbol}</div>
        <div className="detail-meta">
          <span className={`badge ${isBull ? 'badge-bullish' : 'badge-bearish'}`}>
            {isBull ? '▲' : '▼'} {isBull ? T.bullish : T.bearish}
          </span>
          <span className="detail-tf">{signal.timeframe}</span>
          {signal.premium_level !== 'FREE' && (
            <span className={`badge badge-${signal.premium_level.toLowerCase()}`}>
              {signal.premium_level === 'LUXE' ? '👑' : '⚡'} {signal.premium_level}
            </span>
          )}
        </div>
      </div>

      {/* Levels */}
      <div className="card detail-levels">
        <p className="section-title">{T.price_levels}</p>
        <div className="level-row">
          <span className="level-label">{T.entry}</span>
          <span className="level-value level-entry">{signal.entry?.toLocaleString()}</span>
        </div>
        <div className="divider" style={{ margin: '10px 0' }} />
        <div className="level-row">
          <span className="level-label">{T.stop_loss}</span>
          <span className="level-value level-sl">{signal.stop_loss?.toLocaleString()}</span>
        </div>
        {tps.length > 0 && <div className="divider" style={{ margin: '10px 0' }} />}
        {tps.map(({ label, value }) => (
          <div key={label} className="level-row" style={{ marginBottom: 4 }}>
            <span className="level-label">{label}</span>
            <span className="level-value level-tp">{value.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* Confidence */}
      <div className="card" style={{ marginTop: 10 }}>
        <div className="conf-row">
          <p className="section-title" style={{ marginBottom: 0 }}>{T.confidence}</p>
          <span className="conf-value" style={{ color: confColor }}>
            {Math.round(signal.confidence_score)}%
          </span>
        </div>
        <div className="conf-bar">
          <div
            className="conf-bar__fill"
            style={{ width: `${signal.confidence_score}%`, background: confColor }}
          />
        </div>
      </div>

      {/* AI Summary */}
      {signal.ai_summary && (
        <div className="card" style={{ marginTop: 10 }}>
          <p className="section-title">{T.ai_summary}</p>
          <p className="detail-ai__text">"{signal.ai_summary}"</p>
        </div>
      )}
    </div>
  );
}
