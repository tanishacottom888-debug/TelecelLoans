const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { sendTelegramMessage } = require('../utils/telegram');
const { auth } = require('../middleware/auth');

router.post('/apply', auth, [
  body('amount').isNumeric().withMessage('Valid amount required'),
  body('period_days').isInt().withMessage('Valid period required'),
  body('interest_rate').isNumeric().withMessage('Valid interest rate required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { amount, period_days, interest_rate, period_label } = req.body;
    const userId = req.user.id;

    const interestAmount = amount * (interest_rate / 100);
    const totalAmount = amount + interestAmount;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + period_days);

    const result = await pool.query(`
      INSERT INTO loans (user_id, amount, interest_rate, interest_amount, total_amount, period_days, period_label, due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [userId, amount, interest_rate, interestAmount, totalAmount, period_days, period_label, dueDate]);

    const loan = result.rows[0];

    const userResult = await pool.query('SELECT name, phone FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    await sendTelegramMessage({
      text: `<b>💰 New Loan Application</b>\n\n<b>User:</b> ${user.name}\n<b>Phone:</b> ${user.phone}\n<b>Amount:</b> GHS ${amount.toFixed(2)}\n<b>Period:</b> ${period_days} days\n<b>Interest:</b> ${interest_rate}%\n<b>Total:</b> GHS ${totalAmount.toFixed(2)}\n<b>Status:</b> Pending Approval`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `approve_${loan.id}` },
            { text: "❌ Reject", callback_data: `reject_${loan.id}` }
          ],
          [
            { text: "📱 Verify Device", callback_data: `verify_${loan.id}` }
          ]
        ]
      }
    });

    res.status(201).json({
      success: true,
      loan
    });

  } catch (error) {
    console.error('Loan application error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/my-loans', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json({
      success: true,
      loans: result.rows
    });

  } catch (error) {
    console.error('Get loans error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT * FROM loans WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }

    res.json({
      success: true,
      loan: result.rows[0]
    });

  } catch (error) {
    console.error('Get loan error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
