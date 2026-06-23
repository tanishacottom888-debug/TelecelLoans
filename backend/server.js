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
      password, // In production, hash this!
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
app.post('/api/loans/apply', (req, res) => {
  try {
    const { amount, period_days, interest_rate, period_label, userId } = req.body;
    const interestAmount = amount * (interest_rate / 100);
    const totalAmount = amount + interestAmount;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + period_days);
    
    const loan = {
      id: 'loan_' + Date.now(),
      userId: userId || 'user_123',
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
    
    res.status(201).json({
      success: true,
      loan
    });
  } catch (error) {
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
app.put('/api/loans/:id/status', (req, res) => {
  const { status } = req.body;
  const loan = loans.find(l => l.id === req.params.id);
  if (!loan) {
    return res.status(404).json({ success: false, message: 'Loan not found' });
  }
  loan.status = status;
  if (status === 'disbursed') {
    loan.disbursed_at = new Date();
  }
  res.json({ success: true, loan });
});

// ─── TELEGRAM ENDPOINT ───

// Send to Telegram (simulated)
app.post('/api/telegram/send-auth', (req, res) => {
  const { phone, amount, name } = req.body;
  console.log(`📱 Telegram Auth Request: ${name} (${phone}) - GHS ${amount}`);
  // In production, call Telegram API here
  res.json({ 
    success: true, 
    message: 'Authorization request sent to admin' 
  });
});

// ─── START SERVER ───

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
});

// Export for Railway
module.exports = app;
