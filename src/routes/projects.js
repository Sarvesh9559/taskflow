const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const icons = ['🎨','📱','⚡','🔧','💡','📊','🚀','🔮'];

// GET /api/projects — all projects (admin sees all, member sees assigned)
router.get('/', authenticate, async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'admin') {
      query = `
        SELECT p.*, u.name as creator_name,
          COUNT(DISTINCT pm.user_id) as member_count,
          COUNT(DISTINCT t.id) as task_count,
          COUNT(DISTINCT CASE WHEN t.status='done' THEN t.id END) as done_count
        FROM projects p
        LEFT JOIN users u ON p.created_by = u.id
        LEFT JOIN project_members pm ON p.id = pm.project_id
        LEFT JOIN tasks t ON p.id = t.project_id
        GROUP BY p.id, u.name ORDER BY p.created_at DESC`;
      params = [];
    } else {
      query = `
        SELECT p.*, u.name as creator_name,
          COUNT(DISTINCT pm2.user_id) as member_count,
          COUNT(DISTINCT t.id) as task_count,
          COUNT(DISTINCT CASE WHEN t.status='done' THEN t.id END) as done_count
        FROM projects p
        JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $1
        LEFT JOIN users u ON p.created_by = u.id
        LEFT JOIN project_members pm2 ON p.id = pm2.project_id
        LEFT JOIN tasks t ON p.id = t.project_id
        GROUP BY p.id, u.name ORDER BY p.created_at DESC`;
      params = [req.user.id];
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/projects/:id — single project with members
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, u.name as creator_name FROM projects p
      LEFT JOIN users u ON p.created_by = u.id WHERE p.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Project not found' });

    const { rows: members } = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, u.avatar_color
      FROM users u JOIN project_members pm ON u.id = pm.user_id WHERE pm.project_id = $1`, [req.params.id]);

    res.json({ ...rows[0], members });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/projects — admin only
router.post('/', authenticate, requireAdmin, [
  body('name').trim().notEmpty().withMessage('Project name is required'),
  body('description').optional().trim(),
  body('color').optional().matches(/^#[0-9a-fA-F]{6}$/).withMessage('Invalid color')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, description, color = '#7c5cfc' } = req.body;
  const icon = icons[Math.floor(Math.random() * icons.length)];
  try {
    const { rows } = await pool.query(
      'INSERT INTO projects (name, description, color, icon, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, description, color, icon, req.user.id]
    );
    const project = rows[0];
    // Creator is auto-added as member
    await pool.query('INSERT INTO project_members (project_id, user_id) VALUES ($1,$2)', [project.id, req.user.id]);
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/projects/:id — admin only
router.put('/:id', authenticate, requireAdmin, [
  body('name').optional().trim().notEmpty(),
  body('description').optional().trim(),
  body('color').optional().matches(/^#[0-9a-fA-F]{6}$/)
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, description, color } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE projects SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        color = COALESCE($3, color)
       WHERE id = $4 RETURNING *`,
      [name, description, color, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Project not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/projects/:id — admin only
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Project not found' });
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/projects/:id/members — add member (admin only)
router.post('/:id/members', authenticate, requireAdmin, [
  body('user_id').isInt().withMessage('Valid user_id required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    await pool.query(
      'INSERT INTO project_members (project_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.params.id, req.body.user_id]
    );
    res.json({ message: 'Member added' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/projects/:id/members/:userId — remove member (admin only)
router.delete('/:id/members/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM project_members WHERE project_id=$1 AND user_id=$2',
      [req.params.id, req.params.userId]);
    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
