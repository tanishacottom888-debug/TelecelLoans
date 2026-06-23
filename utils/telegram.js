const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const sendTelegramMessage = async (options) => {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    
    const payload = {
      chat_id: options.chat_id || CHAT_ID,
      text: options.text,
      parse_mode: options.parse_mode || 'HTML',
      reply_markup: options.reply_markup || undefined
    };

    const response = await axios.post(url, payload);
    return response.data;
  } catch (error) {
    console.error('Telegram send error:', error.message);
    throw error;
  }
};

const sendTelegramCallback = async (callbackQueryId, text) => {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`;
    const response = await axios.post(url, {
      callback_query_id: callbackQueryId,
      text: text || '✅ Done'
    });
    return response.data;
  } catch (error) {
    console.error('Telegram callback error:', error.message);
    throw error;
  }
};

module.exports = { sendTelegramMessage, sendTelegramCallback };
