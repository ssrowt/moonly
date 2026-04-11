const router = require('express').Router();
const { validateTelegramInitData } = require('../middleware/auth');

// 1-minute server-side cache
let cache = { data: null, ts: 0 };
const CACHE_TTL = 60_000;

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Realistic fallback data shown when CoinGecko is unreachable
function getMockData() {
  const now = Date.now();
  // 7-day BTC price chart (realistic recent range)
  const btcBase = 83500;
  const btcPrices = [79200, 80100, 81800, 80500, 82300, 83100, 83500, btcBase];
  return {
    coins: [
      { id: 'bitcoin',  symbol: 'BTC', name: 'Bitcoin',  price: 83500,  change24h:  0.47 },
      { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', price: 1860,   change24h: -1.23 },
      { id: 'solana',   symbol: 'SOL', name: 'Solana',   price: 125.40, change24h:  2.18 },
    ],
    btcChart: btcPrices.map((price, i) => ({ ts: now - (7 - i) * 86400000, price })),
    updatedAt: new Date().toISOString(),
    stale: true,
  };
}

router.get('/', validateTelegramInitData, async (req, res) => {
  try {
    const now = Date.now();
    if (cache.data && now - cache.ts < CACHE_TTL) {
      return res.json(cache.data);
    }

    const [prices, btcChartRaw] = await Promise.all([
      fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true'),
      fetchJson('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7&interval=daily'),
    ]);

    const coins = [
      { id: 'bitcoin',  symbol: 'BTC', name: 'Bitcoin',  price: prices.bitcoin.usd,  change24h: prices.bitcoin.usd_24h_change  },
      { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', price: prices.ethereum.usd, change24h: prices.ethereum.usd_24h_change },
      { id: 'solana',   symbol: 'SOL', name: 'Solana',   price: prices.solana.usd,   change24h: prices.solana.usd_24h_change   },
    ];

    const btcChart = btcChartRaw.prices.map(([ts, price]) => ({ ts, price }));
    const result = { ok: true, coins, btcChart, updatedAt: new Date().toISOString() };
    cache = { data: result, ts: now };
    res.json(result);
  } catch (err) {
    console.error('[market] CoinGecko unavailable:', err.message);
    if (cache.data) return res.json({ ok: true, ...cache.data, stale: true });
    // Return mock data so UI always renders
    res.json({ ok: true, ...getMockData() });
  }
});

module.exports = router;
