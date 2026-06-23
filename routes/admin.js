const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { auth, requireAdmin } = require('../middleware/auth');

router.get('/pending-loans', auth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, u.name, u.phone, u.email
      FROM loans l
      JOIN users u ON l.user_id = u.id
      WHERE l.status = 'pending'
      ORDER BY l.created_at ASC
    `);

    res.json({
      success: true,
      loans: result.rows
    });

  } catch (error) {
    console.error('Get pending loans error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/all-loans', auth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, u.name, u.phone, u.email
      FROM loans l
      JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC
    `);

    res.json({
      success: true,
      loans: result.rows
    });

  } catch (error) {
    console.error('Get all loans error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/update-status/:id', auth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected', 'disbursed', 'repaid'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const result = await pool.query(
      'UPDATE loans SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }

    if (status === 'disbursed') {
      await pool.query(
        'UPDATE loans SET disbursed_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );
    }

    if (status === 'repaid') {
      await pool.query(
        'UPDATE loans SET repaid_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );
    }

    res.json({
      success: true,
      loan: result.rows[0]
    });

  } catch (error) {
    console.error('Update loan status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/stats', auth, requireAdmin, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'disbursed') as disbursed,
        COUNT(*) FILTER (WHERE status = 'repaid') as repaid,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        SUM(amount) FILTER (WHERE status = 'disbursed' OR status = 'repaid') as total_disbursed
      FROM loans
    `);

    const users = await pool.query('SELECT COUNT(*) as total_users FROM users');

    res.json({
      success: true,
      stats: {
        ...stats.rows[0],
        total_users: users.rows[0].total_users
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/users', auth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, phone, email, employment_status, monthly_income, is_verified, is_admin, created_at FROM users ORDER BY created_at DESC'
    );

    res.json({
      success: true,
      users: result.rows
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
