const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../db');
const { authenticate, requireAdmin, canEditTask } = require('../middleware/auth');

const taskSelect = `
  SELECT t.*,
    u.name as assignee_name, u.avatar_color as assignee_color,
    p.name as project_name, p.color as project_color
  FROM tasks t
  LEFT JOIN users u ON t.assignee_id = u.id
  LEFT JOIN projects p ON t.project_id = p.id
`;

// GET /api/tasks — admin gets all, member gets own
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, priority, project_id } = req.query;
    let conditions = [];
    let params = [];
    let idx = 1;

    if (req.user.role !== 'admin') {
      conditions.push(`t.assignee_id = $${idx++}`);
      params.push(req.user.id);
    }
    if (status) { conditions.push(`t.status = $${idx++}`); params.push(status); }
    if (priority) { conditions.push(`t.priority = $${idx++}`); params.push(priority); }
    if (project_id) { conditions.push(`t.project_id = $${idx++}`); params.push(project_id); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await pool.query(`${taskSelect} ${where} ORDER BY t.created_at DESC`, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tasks/stats — dashboard stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const uid = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const filter = isAdmin ? '' : `WHERE t.assignee_id = ${uid}`;

    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE assignee_id = ${uid}) as my_tasks,
        COUNT(*) FILTER (WHERE status = 'in-progress' ${isAdmin ? '' : `AND assignee_id = ${uid}`}) as in_progress,
        COUNT(*) FILTER (WHERE status = 'done' ${isAdmin ? '' : `AND assignee_id = ${uid}`}) as done,
        COUNT(*) FILTER (WHERE status != 'done' AND due_date < CURRENT_DATE ${isAdmin ? '' : `AND assignee_id = ${uid}`}) as overdue,
        COUNT(*) as total
      FROM tasks t ${filter.replace('WHERE t.', 'WHERE ')}`
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tasks/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`${taskSelect} WHERE t.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
    if (req.user.role !== 'admin' && rows[0].assignee_id !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks
router.post('/', authenticate, [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('project_id').isInt().withMessage('Valid project_id required'),
  body('status').optional().isIn(['todo','in-progress','done']),
  body('priority').optional().isIn(['low','medium','high']),
  body('assignee_id').optional().isInt(),
  body('due_date').optional().isDate().withMessage('Valid date required (YYYY-MM-DD)')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { title, description, project_id, status='todo', priority='medium', assignee_id, due_date } = req.body;
  try {
    // Members can only assign to themselves
    const finalAssignee = req.user.role !== 'admin' ? req.user.id : (assignee_id || req.user.id);

    const { rows } = await pool.query(
      `INSERT INTO tasks (title, description, project_id, status, priority, assignee_id, created_by, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [title, description, project_id, status, priority, finalAssignee, req.user.id, due_date || null]
    );
    const { rows: full } = await pool.query(`${taskSelect} WHERE t.id = $1`, [rows[0].id]);
    res.status(201).json(full[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/tasks/:id
router.put('/:id', authenticate, canEditTask, [
  body('title').optional().trim().notEmpty(),
  body('status').optional().isIn(['todo','in-progress','done']),
  body('priority').optional().isIn(['low','medium','high']),
  body('assignee_id').optional().isInt(),
  body('due_date').optional().isDate()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { title, description, project_id, status, priority, assignee_id, due_date } = req.body;
  // Members can't reassign tasks to others
  const finalAssignee = req.user.role !== 'admin' ? undefined : assignee_id;

  try {
    const { rows } = await pool.query(
      `UPDATE tasks SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        project_id = COALESCE($3, project_id),
        status = COALESCE($4, status),
        priority = COALESCE($5, priority),
        assignee_id = COALESCE($6, assignee_id),
        due_date = COALESCE($7, due_date),
        updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [title, description, project_id, status, priority, finalAssignee, due_date, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
    const { rows: full } = await pool.query(`${taskSelect} WHERE t.id = $1`, [rows[0].id]);
    res.json(full[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/tasks/:id — admin only
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
