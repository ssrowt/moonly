const TelegramBot = require('node-telegram-bot-api');
const { db, upsertUser } = require('../db');

let bot = null;

function getBot() {
  return bot;
}

function initBot() {
  if (!process.env.BOT_TOKEN) {
    console.warn('[bot] BOT_TOKEN not set — bot disabled');
    return null;
  }

  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && process.env.WEBHOOK_URL) {
    // Webhook mode for production
    bot = new TelegramBot(process.env.BOT_TOKEN, { webHook: true });
    bot.setWebHook(`${process.env.WEBHOOK_URL}/webhook`);
    console.log('[bot] Started in webhook mode');
  } else {
    // Polling mode for development
    bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
    console.log('[bot] Started in polling mode');
  }

  registerCommands(bot);
  return bot;
}

function registerCommands(bot) {
  const frontendUrl = process.env.FRONTEND_URL || '';
  const botUsername = process.env.BOT_USERNAME || 'moonlybot';

  // /start [referral_code]
  bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramUser = msg.from;
    const referralCode = match[1] ? match[1].trim() : null;

    // Register user
    upsertUser({
      id: telegramUser.id,
      username: telegramUser.username,
      first_name: telegramUser.first_name,
      referred_by_code: referralCode,
    });

    const firstName = telegramUser.first_name || 'there';
    const welcomeText =
      `👋 Welcome to *Moonly*, ${firstName}!\n\n` +
      `📊 Premium crypto signals & AI market analysis — right in Telegram.\n\n` +
      `Tap the button below to open the app:`;

    const options = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🌙 Open Moonly',
              web_app: { url: frontendUrl },
            },
          ],
          [
            { text: '💎 View Plans', callback_data: 'show_plans' },
            { text: '👥 Referral', callback_data: 'show_referral' },
          ],
        ],
      },
    };

    bot.sendMessage(chatId, welcomeText, options);
  });

  // /signals
  bot.onText(/\/signals/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      '📈 Open the app to see today\'s signals:',
      {
        reply_markup: {
          inline_keyboard: [[{ text: '🌙 Open Moonly', web_app: { url: frontendUrl } }]],
        },
      }
    );
  });

  // /subscribe
  bot.onText(/\/subscribe/, (msg) => {
    const chatId = msg.chat.id;
    const plansText =
      `💎 *Moonly Plans*\n\n` +
      `🆓 *FREE* — Basic access to signals\n` +
      `⚡ *PRO* — All signals + AI Analysis + notifications _(weekly)_\n` +
      `👑 *LUXE* — Everything + premium signals _(monthly)_\n\n` +
      `Open the app to upgrade:`;

    bot.sendMessage(chatId, plansText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '🌙 Open Moonly', web_app: { url: frontendUrl } }]],
      },
    });
  });

  // /mystatus
  bot.onText(/\/mystatus/, (msg) => {
    const chatId = msg.chat.id;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(msg.from.id);

    if (!user) {
      return bot.sendMessage(chatId, 'You are not registered yet. Send /start to begin.');
    }

    let statusText = `📋 *Your Moonly Status*\n\nPlan: *${user.plan}*`;
    if (user.plan !== 'FREE' && user.plan_expires_at) {
      const expires = new Date(user.plan_expires_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
      statusText += `\nExpires: ${expires}`;
    }

    bot.sendMessage(chatId, statusText, { parse_mode: 'Markdown' });
  });

  // /help
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      `*Moonly Commands*\n\n` +
      `/start — Open the app\n` +
      `/signals — View today's signals\n` +
      `/subscribe — View subscription plans\n` +
      `/mystatus — Your current plan\n` +
      `/help — This message`,
      { parse_mode: 'Markdown' }
    );
  });

  // Callback queries (inline button taps)
  bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;

    if (query.data === 'show_plans') {
      bot.answerCallbackQuery(query.id);
      bot.sendMessage(
        chatId,
        `💎 *Moonly Plans*\n\n🆓 *FREE* — Basic\n⚡ *PRO* — Weekly\n👑 *LUXE* — Monthly`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🌙 Open Moonly', web_app: { url: frontendUrl } }]],
          },
        }
      );
    }

    if (query.data === 'show_referral') {
      bot.answerCallbackQuery(query.id);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(query.from.id);
      if (user) {
        const link = `https://t.me/${botUsername}?start=${user.referral_code}`;
        bot.sendMessage(chatId, `👥 *Your referral link:*\n\n\`${link}\``, { parse_mode: 'Markdown' });
      }
    }
  });

  bot.on('polling_error', (err) => console.error('[bot] Polling error:', err.message));
  bot.on('error', (err) => console.error('[bot] Error:', err.message));
}

module.exports = { initBot, getBot };
