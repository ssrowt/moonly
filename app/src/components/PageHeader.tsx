import WebApp from '@twa-dev/sdk';
import { hapticFeedback } from '../utils/telegram';
import { useLang } from '../i18n/LangContext';
import './PageHeader.css';

export default function PageHeader() {
  const { T } = useLang();
  return (
    <div className="page-header">
      <div className="page-header__logo">
        <MoonIcon />
        <div className="page-header__text">
          <span className="page-header__name">Moonly</span>
          <span className="page-header__sub">{T.header_sub}</span>
        </div>
      </div>
      <a
        className="page-header__tg"
        href="https://t.me/cryptyqo"
        onClick={(e) => {
          e.preventDefault();
          hapticFeedback('light');
          try {
            WebApp.openTelegramLink('https://t.me/cryptyqo');
          } catch {
            window.open('https://t.me/cryptyqo', '_blank');
          }
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.28 13.376l-2.95-.924c-.641-.203-.654-.641.136-.953l11.52-4.44c.534-.194 1.001.131.908.162z" />
        </svg>
        @cryptyqo
      </a>
    </div>
  );
}

export function MoonIcon() {
  return (
    <div className="moon-icon">
      <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="phMoonBase" x1="4" y1="40" x2="36" y2="4" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="55%" stopColor="#93c5fd" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
          <mask id="phCrescentMask">
            <circle cx="22" cy="22" r="18" fill="white" />
            <circle cx="29" cy="18" r="14" fill="black" />
          </mask>
        </defs>
        <circle cx="22" cy="22" r="18" fill="url(#phMoonBase)" mask="url(#phCrescentMask)" />
        <polygon points="22,4 10,14 16,28" fill="white" fillOpacity="0.12" mask="url(#phCrescentMask)" />
        <polygon points="22,4 16,28 22,38" fill="white" fillOpacity="0.07" mask="url(#phCrescentMask)" />
        <polygon points="4,22 10,14 16,28" fill="white" fillOpacity="0.08" mask="url(#phCrescentMask)" />
        <polygon points="4,22 16,28 8,34" fill="#3b82f6" fillOpacity="0.18" mask="url(#phCrescentMask)" />
      </svg>
    </div>
  );
}
