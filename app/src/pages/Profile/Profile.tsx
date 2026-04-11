import { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { hapticFeedback } from '../../utils/telegram';
import { useLang } from '../../i18n/LangContext';
import { translatePeriod, translateFeature, translateLabel } from '../../i18n/planTranslations';
import type { User, Subscription, PlanInfo } from '../../types';
import './Profile.css';

export default function Profile() {
  const { T, lang, toggle } = useLang();
  const [user, setUser] = useState<User | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<{ profile: User }>('/api/profile'),
      api.get<{ subscription: Subscription; plans: PlanInfo[] }>('/api/subscription'),
    ]).then(([profileRes, subRes]) => {
      setUser(profileRes.profile);
      setSub(subRes.subscription);
      setPlans(subRes.plans);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const copyReferral = () => {
    const link = user?.referral_link || '';
    navigator.clipboard.writeText(link).then(() => {
      hapticFeedback('success');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleUpgrade = async (planId: string) => {
    setActivating(planId);
    hapticFeedback('medium');
    try {
      const res = await api.post<{ plan: string; plan_expires_at: string; days_remaining: number }>(
        '/api/subscription/activate',
        { plan: planId }
      );
      setSub(prev => prev ? {
        ...prev,
        plan: res.plan as any,
        plan_expires_at: res.plan_expires_at,
        days_remaining: res.days_remaining,
      } : prev);
      setUser(prev => prev ? { ...prev, plan: res.plan as any } : prev);
      hapticFeedback('success');
    } catch (err: any) {
      alert(err.message || T.could_not_activate);
    } finally {
      setActivating(null);
    }
  };

  if (loading) return (
    <div className="page"><div className="state-center"><div className="spinner" /></div></div>
  );

  if (!user || !sub) return null;

  return (
    <div className="page">
      <h1 style={{ marginBottom: 20 }}>{T.profile}</h1>

      {/* User */}
      <div className="card profile-user">
        <div className="profile-avatar">
          {(user.first_name?.[0] || user.username?.[0] || '?').toUpperCase()}
        </div>
        <div className="profile-info">
          <div className="profile-name">{user.first_name || user.username || 'User'}</div>
          {user.username && <div className="profile-username">@{user.username}</div>}
          <span className={`badge badge-${user.plan.toLowerCase()} profile-plan-badge`}>
            {planIcon(user.plan)} {user.plan}
          </span>
        </div>
      </div>

      {/* Sub status */}
      {sub.plan !== 'FREE' && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="sub-status__row">
            <span className="section-title" style={{ marginBottom: 0 }}>{T.subscription}</span>
            <span className={`badge badge-${sub.plan.toLowerCase()}`}>{planIcon(sub.plan)} {sub.plan}</span>
          </div>
          {sub.days_remaining != null && (
            <p className="sub-status__days">{T.days_remaining(sub.days_remaining)}</p>
          )}
        </div>
      )}

      {/* Plans */}
      <div style={{ marginTop: 22 }}>
        <p className="section-title">{T.plans}</p>
        {plans.map(plan => {
          const isActive = sub.plan === plan.id;
          const isLuxe = plan.id === 'LUXE';
          return (
            <div
              key={plan.id}
              className={`card plan-card plan-card--type-${plan.id.toLowerCase()} ${isActive ? `plan-card--active plan-card--${plan.id.toLowerCase()}` : ''}`}
            >
              <div className="plan-card__top">
                <div>
                  <span className="plan-card__name">{planIcon(plan.id)} {translateLabel(plan.label, lang)}</span>
                  <span className="plan-card__period">{translatePeriod(plan.period, lang)}</span>
                </div>
                {isActive && <span className="plan-card__current">{T.current}</span>}
              </div>

              <ul className="plan-card__features">
                {plan.features.map((f, i) => <li key={i}>{translateFeature(f, lang)}</li>)}
              </ul>

              {!isActive && plan.id !== 'FREE' && (
                <button
                  className={`btn ${isLuxe ? 'btn-primary' : 'btn-outline'}`}
                  style={{ marginTop: 14 }}
                  disabled={activating === plan.id}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {activating === plan.id ? T.activating : T.get_plan(translateLabel(plan.label, lang))}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Referral */}
      <div style={{ marginTop: 22 }}>
        <p className="section-title">{T.referral}</p>
        <div className="card referral-card">
          <p className="referral-card__desc">{T.referral_desc}</p>
          <div className="referral-link-row">
            <code className="referral-link">{user.referral_link}</code>
            <button
              className={`btn btn-ghost referral-copy ${copied ? 'referral-copy--done' : ''}`}
              onClick={copyReferral}
            >
              {copied ? T.copied : T.copy}
            </button>
          </div>
          {!!user.referral_count && user.referral_count > 0 && (
            <p className="referral-count">{T.friends_invited(user.referral_count)}</p>
          )}
        </div>
      </div>

      {/* Language toggle */}
      <div style={{ marginTop: 22, marginBottom: 8 }}>
        <p className="section-title">{T.language}</p>
        <div className="card lang-toggle">
          <button
            className={`lang-btn ${lang === 'en' ? 'lang-btn--active' : ''}`}
            onClick={() => lang !== 'en' && toggle()}
          >
            🇬🇧 English
          </button>
          <button
            className={`lang-btn ${lang === 'ru' ? 'lang-btn--active' : ''}`}
            onClick={() => lang !== 'ru' && toggle()}
          >
            🇷🇺 Русский
          </button>
        </div>
      </div>
    </div>
  );
}

const planIcon = (plan: string) =>
  plan === 'LUXE' ? '👑' : plan === 'PRO' ? '⚡' : '🆓';
