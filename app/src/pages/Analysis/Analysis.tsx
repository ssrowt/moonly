import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { useLang } from '../../i18n/LangContext';
import { translateInsight, translateVolatility, translateOpportunity } from '../../i18n/planTranslations';
import type { Analysis as AnalysisType } from '../../types';
import './Analysis.css';

export default function Analysis() {
  const { T, lang } = useLang();
  const [data, setData] = useState<AnalysisType | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<{ analysis: AnalysisType }>('/api/analysis')
      .then(d => setData(d.analysis))
      .catch(err => { if (err.status === 403) setLocked(true); })
      .finally(() => setLoading(false));
  }, []);

  const locale = lang === 'ru' ? 'ru-RU' : 'en-US';

  if (loading) return (
    <div className="page"><div className="state-center"><div className="spinner" /></div></div>
  );

  if (locked) return (
    <div className="page">
      <div className="analysis-header"><h1>{T.ai_analysis}</h1></div>
      <div className="state-center">
        <span style={{ fontSize: 44 }}>🤖</span>
        <h2>{T.pro_feature}</h2>
        <p style={{ fontSize: 14, color: 'var(--text-sec)' }}>{T.pro_desc}</p>
        <button className="btn btn-primary" style={{ marginTop: 8, maxWidth: 220 }} onClick={() => navigate('/profile')}>
          {T.upgrade_plan}
        </button>
      </div>
    </div>
  );

  if (!data) return (
    <div className="page">
      <div className="analysis-header"><h1>{T.ai_analysis}</h1></div>
      <div className="state-center">
        <span style={{ fontSize: 36 }}>📊</span>
        <p>{T.no_analysis}</p>
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="analysis-header">
        <h1>{T.ai_analysis}</h1>
        <span className="analysis-time">{formatTime(data.created_at, locale)}</span>
      </div>

      {/* Sentiment */}
      <div className={`card analysis-sentiment analysis-sentiment--${data.market_sentiment.toLowerCase()}`}>
        <div className="analysis-sentiment__label">{T.sentiment}</div>
        <div className="analysis-sentiment__value">
          {sentimentIcon(data.market_sentiment)} {translateSentiment(data.market_sentiment, T)}
        </div>
        {data.fear_greed_index != null && (
          <div className="analysis-fg">
            <span>{T.fear_greed}</span>
            <div className="analysis-fg__bar">
              <div className="analysis-fg__fill" style={{ width: `${data.fear_greed_index}%` }} />
            </div>
            <span className="analysis-fg__val">{data.fear_greed_index}</span>
          </div>
        )}
      </div>

      {/* Risk */}
      <div className="card" style={{ marginTop: 10 }}>
        <div className="risk-row">
          <span className="section-title" style={{ marginBottom: 0 }}>{T.risk_level}</span>
          <span className={`badge badge-risk-${data.risk_level.toLowerCase()}`}>
            {riskIcon(data.risk_level)} {translateRisk(data.risk_level, T)}
          </span>
        </div>
        {data.volatility_note && <p className="risk-note">{translateVolatility(data.volatility_note, lang)}</p>}
      </div>

      {/* Insights */}
      {data.ai_insights.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <p className="section-title">{T.ai_insights}</p>
          <div className="insights-list">
            {data.ai_insights.map((insight, i) => (
              <div key={i} className="card insight-card">
                <span className="insight-icon">💡</span>
                <p>{translateInsight(insight, lang)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opportunities */}
      {data.top_opportunities.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <p className="section-title">{T.opportunities}</p>
          {data.top_opportunities.map((opp, i) => (
            <div key={i} className="card opp-card">
              <div className="opp-card__top">
                <span className="opp-symbol">{opp.symbol}</span>
                <span className="opp-rank">#{i + 1}</span>
              </div>
              <p className="opp-reason">{translateOpportunity(opp.reason, lang)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const sentimentIcon = (s: string) => s === 'BULLISH' ? '🟢' : s === 'BEARISH' ? '🔴' : '⚪';
const riskIcon = (r: string) => r === 'LOW' ? '🟢' : r === 'MEDIUM' ? '🟡' : '🔴';

function translateSentiment(s: string, T: any) {
  if (s === 'BULLISH') return T.bullish;
  if (s === 'BEARISH') return T.bearish;
  return T.neutral;
}
function translateRisk(r: string, T: any) {
  if (r === 'LOW') return T.risk_low;
  if (r === 'MEDIUM') return T.risk_medium;
  return T.risk_high;
}

function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
