import WebApp from '@twa-dev/sdk';

export function initTelegram() {
  try {
    WebApp.ready();
    WebApp.expand();
    WebApp.setBackgroundColor('#070a1b');
    WebApp.setHeaderColor('#070a1b');
  } catch (e) {
    console.warn('[telegram] WebApp not available (running outside Telegram)');
  }
}

export function getTelegramUser() {
  try {
    return WebApp.initDataUnsafe?.user ?? null;
  } catch {
    return null;
  }
}

export function getInitData(): string {
  try {
    return WebApp.initData || '';
  } catch {
    return '';
  }
}

export function hapticFeedback(type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light') {
  try {
    if (type === 'success' || type === 'error') {
      WebApp.HapticFeedback.notificationOccurred(type);
    } else {
      WebApp.HapticFeedback.impactOccurred(type);
    }
  } catch {}
}

export function closeApp() {
  try { WebApp.close(); } catch {}
}
