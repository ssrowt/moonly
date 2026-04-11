// Maps known backend plan strings to Russian equivalents

const periodMap: Record<string, string> = {
  'Forever':  'Навсегда',
  'Weekly':   'Еженедельно',
  'Monthly':  'Ежемесячно',
};

const featureMap: Record<string, string> = {
  'Limited signal access (FREE-tier only)': 'Ограниченный доступ к сигналам',
  'Basic interface':                         'Базовый интерфейс',
  'All standard signals':                    'Все стандартные сигналы',
  'AI Market Analysis':                      'ИИ анализ рынка',
  'Push notifications':                      'Push-уведомления',
  'Fast access':                             'Быстрый доступ',
  'Everything in PRO':                       'Всё из PRO',
  'Premium & high-confidence signals':       'Премиум сигналы высокой точности',
  'Priority support':                        'Приоритетная поддержка',
  'All future features':                     'Все будущие функции',
};

const labelMap: Record<string, string> = {
  'Free': 'Бесплатно',
  'Pro':  'Про',
  'Luxe': 'Люкс',
};

export function translatePeriod(period: string, lang: string): string {
  if (lang !== 'ru') return period;
  return periodMap[period] ?? period;
}

export function translateFeature(feature: string, lang: string): string {
  if (lang !== 'ru') return feature;
  return featureMap[feature] ?? feature;
}

export function translateLabel(label: string, lang: string): string {
  if (lang !== 'ru') return label;
  return labelMap[label] ?? label;
}

// ─── Analysis content ────────────────────────────────────────────────────────

const insightMap: Record<string, string> = {
  'BTC dominance rising \uFFFD altcoin season likely delayed':  'Доминирование BTC растёт → альтсезон, скорее всего, откладывается',
  'BTC dominance rising → altcoin season likely delayed':       'Доминирование BTC растёт → альтсезон, скорее всего, откладывается',
  'Fed meeting next week \uFFFD watch for macro volatility':    'Заседание ФРС на следующей неделе → следите за макро-волатильностью',
  'Fed meeting next week → watch for macro volatility':         'Заседание ФРС на следующей неделе → следите за макро-волатильностью',
  'On-chain accumulation detected at current levels':           'Обнаружено накопление on-chain на текущих уровнях',
};

const volatilityMap: Record<string, string> = {
  'VIX elevated but trending down': 'VIX повышен, но трендует вниз',
};

const opportunityMap: Record<string, string> = {
  'Breakout above resistance': 'Пробой выше сопротивления',
  'Strong volume surge':       'Сильный всплеск объёма',
};

export function translateInsight(text: string, lang: string): string {
  if (lang !== 'ru') return fixArrow(text);
  return insightMap[text] ?? fixArrow(text);
}

export function translateVolatility(text: string, lang: string): string {
  if (lang !== 'ru') return text;
  return volatilityMap[text] ?? text;
}

export function translateOpportunity(text: string, lang: string): string {
  if (lang !== 'ru') return text;
  return opportunityMap[text] ?? text;
}

// Fix corrupted arrow character from DB
function fixArrow(text: string): string {
  return text.replace(/\uFFFD/g, '→');
}
