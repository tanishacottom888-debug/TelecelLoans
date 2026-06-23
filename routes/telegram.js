const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { sendTelegramMessage } = require('../utils/telegram');

router.post('/webhook', async (req, res) => {
  try {
    const { body } = req;

    if (body.callback_query) {
      const { data, from } = body.callback_query;
      
      const [action, loanId] = data.split('_');

      if (action === 'approve') {
        await pool.query(
          'UPDATE loans SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['approved', loanId]
        );

        const loanResult = await pool.query(`
          SELECT l.*, u.phone, u.name 
          FROM loans l 
          JOIN users u ON l.user_id = u.id 
          WHERE l.id = $1
        `, [loanId]);

        const loan = loanResult.rows[0];

        await sendTelegramMessage({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: `✅ Loan Approved!\n\nName: ${loan.name}\nAmount: GHS ${loan.amount.toFixed(2)}\nPeriod: ${loan.period_days} days\nTotal: GHS ${loan.total_amount.toFixed(2)}\n\n📱 Please proceed to complete verification.`
        });

      } else if (action === 'reject') {
        await pool.query(
          'UPDATE loans SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['rejected', loanId]
        );
      } else if (action === 'verify') {
        await sendTelegramMessage({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: `🔐 Device Verification Required\n\nPlease verify your device to proceed with the loan.\nLoan ID: ${loanId}`
        });
      }

      await sendTelegramMessage({
        method: 'answerCallbackQuery',
        callback_query_id: body.callback_query.id,
        text: '✅ Processing your request...'
      });
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
});

router.post('/test', async (req, res) => {
  try {
    const { message } = req.body;
    await sendTelegramMessage({
      text: message || '🔔 Test message from TelecelLoans backend!'
    });
    res.json({ success: true, message: 'Test message sent' });
  } catch (error) {
    console.error('Test message error:', error);
    res.status(500).json({ success: false, message: 'Failed to send test message' });
  }
});

module.exports = router;
