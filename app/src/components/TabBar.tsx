import { NavLink } from 'react-router-dom';
import { useLang } from '../i18n/LangContext';
import { MoonIcon } from './PageHeader';
import CandlestickIcon from './CandlestickIcon';
import './TabBar.css';

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="8" r="4" fill="currentColor" />
      <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" fill="currentColor" />
    </svg>
  );
}

function AiIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text
        x="1" y="19"
        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
        fontSize="18"
        fontWeight="800"
        fill="currentColor"
        letterSpacing="-0.5"
      >AI</text>
    </svg>
  );
}

export default function TabBar() {
  const { T } = useLang();

  const tabs = [
    { to: '/',         label: T.tab_home,    end: true },
    { to: '/signals',  label: T.tab_signals, end: false },
    { to: '/analysis', label: T.tab_ai,      end: false },
    { to: '/profile',  label: T.tab_profile, end: false },
  ];

  return (
    <nav className="tabbar">
      {tabs.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `tabbar__item ${isActive ? 'tabbar__item--active' : ''}`}
        >
          <span className="tabbar__moon">
            {to === '/signals' ? <CandlestickIcon /> : to === '/analysis' ? <AiIcon /> : to === '/profile' ? <ProfileIcon /> : <MoonIcon />}
          </span>
          <span className="tabbar__label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
