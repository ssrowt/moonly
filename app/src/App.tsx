import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { initTelegram, getTelegramUser } from './utils/telegram';
import { api } from './utils/api';
import TabBar from './components/TabBar';
import Background from './components/Background';
import PageHeader from './components/PageHeader';
import Home from './pages/Home/Home';
import SignalsList from './pages/Signals/SignalsList';
import SignalDetail from './pages/Signals/SignalDetail';
import Analysis from './pages/Analysis/Analysis';
import Profile from './pages/Profile/Profile';
import { LangProvider } from './i18n/LangContext';
import './index.css';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initTelegram();

    const tgUser = getTelegramUser();
    const params = new URLSearchParams(window.location.search);
    const referralCode = params.get('start') ?? undefined;

    const timeout = new Promise<void>(resolve => setTimeout(resolve, 5000));
    Promise.race([
      api.post('/api/auth/register', {
        user: tgUser ?? { id: 1, username: 'devuser', first_name: 'Dev' },
        referral_code: referralCode,
      }).catch(() => {}),
      timeout,
    ]).finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <LangProvider>
        <Background />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <div className="spinner" />
        </div>
      </LangProvider>
    );
  }

  return (
    <LangProvider>
    <HashRouter>
      <Background />
      <div className="app">
        <PageHeader />
        <Routes>
          <Route path="/"            element={<Home />} />
          <Route path="/signals"     element={<SignalsList />} />
          <Route path="/signals/:id" element={<SignalDetail />} />
          <Route path="/analysis"    element={<Analysis />} />
          <Route path="/profile"     element={<Profile />} />
        </Routes>
        <TabBar />
      </div>
    </HashRouter>
    </LangProvider>
  );
}
