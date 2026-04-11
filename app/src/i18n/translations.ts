export type Lang = 'en' | 'ru';

const t = {
  en: {
    // Header
    header_sub:   'Crypto Signals',

    // Directions / sentiment
    bullish:      'BULLISH',
    bearish:      'BEARISH',
    neutral:      'NEUTRAL',
    risk_low:     'LOW',
    risk_medium:  'MEDIUM',
    risk_high:    'HIGH',

    // Plan periods
    period_forever: 'Forever',
    period_weekly:  'Weekly',
    period_monthly: 'Monthly',

    // TabBar
    tab_home:     'Home',
    tab_signals:  'Signals',
    tab_ai:       'Analysis',
    tab_profile:  'Profile',

    // Home
    btc_chart:    'BTC / USD — 7 Day',
    top_coins:    'Top Coins',
    market_unavail: 'Market data unavailable',
    updated:      'Updated',
    cached:       'Cached data',

    // Signals list
    signals:      'Signals',
    active:       'active',
    no_signals:   'No signals, try later',
    failed_signals: 'Server error',
    requires_plan:  (lvl: string) => `Requires ${lvl} plan — tap to upgrade`,
    refresh:      'Refresh',
    winrate:      'Winrate',
    score:        'Score',
    fresh:        'FRESH',
    risk_trade:   '⚠️ RISK',
    buy:          'BUY',
    sell:         'SELL',
    trend_up:     'UP',
    trend_down:   'DOWN',

    // Signal status
    st_active:  'Active',
    st_tp:      'TP Hit',
    st_sl:      'SL Hit',
    st_expired: 'Expired',

    // Signal detail
    back_signals:   '← Signals',
    back:           '← Back',
    premium_signal: 'Premium Signal',
    premium_desc:   'Upgrade your plan to unlock this signal and see entry, stop loss, and take profit levels.',
    view_plans:     'View Plans',
    price_levels:   'Price Levels',
    entry:          'Entry',
    stop_loss:      'Stop Loss',
    confidence:     'Confidence',
    ai_summary:     'AI Summary',

    // Analysis
    ai_analysis:    'AI Analysis',
    pro_feature:    'PRO Feature',
    pro_desc:       'AI market analysis is available on PRO and LUXE plans.',
    upgrade_plan:   'Upgrade Plan',
    no_analysis:    'No analysis available yet',
    sentiment:      'Market Sentiment',
    fear_greed:     'Fear & Greed',
    risk_level:     'Risk Level',
    ai_insights:    'AI Insights',
    opportunities:  'Top Opportunities',

    // Profile
    profile:        'Profile',
    subscription:   'Subscription',
    days_remaining: (n: number) => `${n} day${n !== 1 ? 's' : ''} remaining`,
    plans:          'Plans',
    current:        'Current',
    get_plan:       (label: string) => `Get ${label}`,
    activating:     'Activating…',
    referral:       'Referral',
    referral_desc:  'Invite friends and get rewarded. Share your personal link:',
    copy:           'Copy',
    copied:         '✓',
    friends_invited: (n: number) => `👥 ${n} friend${n !== 1 ? 's' : ''} invited`,
    language:       'Language',
    could_not_activate: 'Could not activate plan',
  },
  ru: {
    // Header
    header_sub:   'Крипто Сигналы',

    // Directions / sentiment
    bullish:      'БЫЧИЙ',
    bearish:      'МЕДВЕЖИЙ',
    neutral:      'НЕЙТРАЛЬНЫЙ',
    risk_low:     'НИЗКИЙ',
    risk_medium:  'СРЕДНИЙ',
    risk_high:    'ВЫСОКИЙ',

    // Plan periods
    period_forever: 'Навсегда',
    period_weekly:  'Еженедельно',
    period_monthly: 'Ежемесячно',

    // TabBar
    tab_home:     'Главная',
    tab_signals:  'Сигналы',
    tab_ai:       'Анализ',
    tab_profile:  'Профиль',

    // Home
    btc_chart:    'BTC / USD — 7 дней',
    top_coins:    'Топ монеты',
    market_unavail: 'Данные рынка недоступны',
    updated:      'Обновлено',
    cached:       'Кэшировано',

    // Signals list
    signals:      'Сигналы',
    active:       'активных',
    no_signals:   'Нет сигналов, попробуйте позже',
    failed_signals: 'Ошибка сервера',
    requires_plan:  (lvl: string) => `Требуется план ${lvl} — нажмите для апгрейда`,
    refresh:      'Обновить',
    winrate:      'Винрейт',
    score:        'Счёт',
    fresh:        'СВЕЖИЙ',
    risk_trade:   '⚠️ РИСК',
    buy:          'ПОКУПКА',
    sell:         'ПРОДАЖА',
    trend_up:     'РОСТ',
    trend_down:   'ПАДЕНИЕ',

    // Signal status
    st_active:  'Активен',
    st_tp:      'ТП достигнут',
    st_sl:      'СЛ достигнут',
    st_expired: 'Истёк',

    // Signal detail
    back_signals:   '← Сигналы',
    back:           '← Назад',
    premium_signal: 'Премиум сигнал',
    premium_desc:   'Обновите план чтобы разблокировать сигнал и увидеть уровни входа, стоп-лосса и тейк-профита.',
    view_plans:     'Посмотреть планы',
    price_levels:   'Ценовые уровни',
    entry:          'Вход',
    stop_loss:      'Стоп-лосс',
    confidence:     'Уверенность',
    ai_summary:     'ИИ анализ',

    // Analysis
    ai_analysis:    'ИИ Анализ',
    pro_feature:    'PRO функция',
    pro_desc:       'ИИ анализ рынка доступен на планах PRO и LUXE.',
    upgrade_plan:   'Обновить план',
    no_analysis:    'Анализ ещё не добавлен',
    sentiment:      'Настроение рынка',
    fear_greed:     'Страх & Жадность',
    risk_level:     'Уровень риска',
    ai_insights:    'ИИ Инсайты',
    opportunities:  'Лучшие возможности',

    // Profile
    profile:        'Профиль',
    subscription:   'Подписка',
    days_remaining: (n: number) => `Осталось ${n} ${dayWord(n)}`,
    plans:          'Планы',
    current:        'Текущий',
    get_plan:       (label: string) => `Получить ${label}`,
    activating:     'Активация…',
    referral:       'Реферал',
    referral_desc:  'Приглашайте друзей и получайте награды. Ваша ссылка:',
    copy:           'Копировать',
    copied:         '✓',
    friends_invited: (n: number) => `👥 Приглашено ${n} ${friendWord(n)}`,
    language:       'Язык',
    could_not_activate: 'Не удалось активировать план',
  },
} as const;

export type Translations = typeof t.en;
export default t;

// Russian plural helpers
function dayWord(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return 'день';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'дня';
  return 'дней';
}
function friendWord(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return 'друг';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'друга';
  return 'друзей';
}
