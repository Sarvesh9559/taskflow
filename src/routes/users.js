const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { pool } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const avatarColors = ['#7c5cfc','#5c8bfc','#3ecf8e','#f5a623','#f5605a','#fc5cbc'];

// GET /api/users — all users (authenticated)
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, avatar_color, created_at FROM users ORDER BY created_at ASC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/:id/stats
router.get('/:id/stats', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status='done') as done,
        COUNT(*) FILTER (WHERE status='in-progress') as in_progress,
        COUNT(*) FILTER (WHERE status='todo') as todo,
        COUNT(*) FILTER (WHERE status!='done' AND due_date < CURRENT_DATE) as overdue
      FROM tasks WHERE assignee_id = $1`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users/invite — admin creates a user (invite)
router.post('/invite', authenticate, requireAdmin, [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('role').isIn(['admin','member']).withMessage('Role must be admin or member')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, role } = req.body;
  const tempPassword = 'temp' + Math.random().toString(36).slice(2, 8);

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows[0]) return res.status(409).json({ error: 'Email already registered' });

    const { rows: allUsers } = await pool.query('SELECT COUNT(*) FROM users');
    const color = avatarColors[parseInt(allUsers[0].count) % avatarColors.length];
    const hashed = await bcrypt.hash(tempPassword, 10);

    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password, role, avatar_color) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role, avatar_color',
      [name, email, hashed, role, color]
    );
    res.status(201).json({ user: rows[0], temp_password: tempPassword });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/:id/role — change role (admin only)
router.put('/:id/role', authenticate, requireAdmin, [
  body('role').isIn(['admin','member']).withMessage('Role must be admin or member')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'Cannot change your own role' });

  try {
    const { rows } = await pool.query(
      'UPDATE users SET role=$1 WHERE id=$2 RETURNING id, name, email, role',
      [req.body.role, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/users/:id — admin only
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'Cannot delete yourself' });
  try {
    const { rows } = await pool.query('DELETE FROM users WHERE id=$1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
