const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
const db = new Database('planning.db');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── API ENDPOINTS ───────────────────────────────────────────────────────────

// Get complete planning data
app.get('/api/planning', (req, res) => {
  try {
    const state = db.prepare('SELECT * FROM planning_state ORDER BY id DESC LIMIT 1').get();

    if (!state) {
      return res.json({
        version: 2,
        zoom: 'week',
        viewStart: new Date().toISOString(),
        rows: [],
        groups: [],
        milestones: [],
        taskIdCounter: 0,
        groupIdCounter: 3,
        msIdCounter: 0
      });
    }

    const groups = db.prepare('SELECT * FROM groups ORDER BY id').all();
    const rows = db.prepare('SELECT * FROM rows ORDER BY id').all();
    const milestones = db.prepare('SELECT * FROM milestones ORDER BY id').all();

    // Get tasks for each row
    const tasksStmt = db.prepare('SELECT * FROM tasks WHERE row_id = ? ORDER BY id');
    const objectivesStmt = db.prepare('SELECT objective FROM task_objectives WHERE task_id = ?');
    const depsStmt = db.prepare('SELECT dep_task_id FROM task_deps WHERE task_id = ?');

    rows.forEach(row => {
      row.tasks = tasksStmt.all(row.id);
      row.tasks.forEach(task => {
        task.objectives = objectivesStmt.all(task.id).map(o => o.objective);
        task.deps = depsStmt.all(task.id).map(d => d.dep_task_id);
      });
    });

    res.json({
      version: state.version,
      zoom: state.zoom,
      viewStart: state.view_start,
      rows: rows.map(r => ({
        id: r.id,
        name: r.name,
        color: r.color,
        groupId: r.group_id,
        metier: r.metier,
        tasks: r.tasks.map(t => ({
          id: t.id,
          name: t.name,
          start: t.start,
          end: t.end,
          color: t.color,
          tjm: t.tjm,
          etp: t.etp,
          progress: t.progress,
          status: t.status,
          objectives: t.objectives,
          deps: t.deps
        }))
      })),
      groups: groups.map(g => ({
        id: g.id,
        name: g.name,
        collapsed: g.collapsed === 1
      })),
      milestones: milestones.map(m => ({
        id: m.id,
        name: m.name,
        date: m.date,
        color: m.color
      })),
      taskIdCounter: state.task_id_counter,
      groupIdCounter: state.group_id_counter,
      msIdCounter: state.ms_id_counter
    });
  } catch (error) {
    console.error('Error fetching planning:', error);
    res.status(500).json({ error: 'Failed to fetch planning data' });
  }
});

// Save complete planning data
app.post('/api/planning', (req, res) => {
  try {
    const data = req.body;

    // Start transaction
    const saveAll = db.transaction(() => {
      // Clear existing data
      db.prepare('DELETE FROM task_deps').run();
      db.prepare('DELETE FROM task_objectives').run();
      db.prepare('DELETE FROM tasks').run();
      db.prepare('DELETE FROM rows').run();
      db.prepare('DELETE FROM groups').run();
      db.prepare('DELETE FROM milestones').run();
      db.prepare('DELETE FROM planning_state').run();

      // Insert planning state
      db.prepare(`
        INSERT INTO planning_state (version, zoom, view_start, task_id_counter, group_id_counter, ms_id_counter, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.version || 2,
        data.zoom || 'week',
        data.viewStart || new Date().toISOString(),
        data.taskIdCounter || 0,
        data.groupIdCounter || 3,
        data.msIdCounter || 0,
        new Date().toISOString()
      );

      // Insert groups
      if (data.groups && data.groups.length > 0) {
        const insertGroup = db.prepare('INSERT INTO groups (id, name, collapsed) VALUES (?, ?, ?)');
        for (const group of data.groups) {
          insertGroup.run(group.id, group.name, group.collapsed ? 1 : 0);
        }
      }

      // Insert rows and tasks
      if (data.rows && data.rows.length > 0) {
        const insertRow = db.prepare('INSERT INTO rows (id, name, color, group_id, metier) VALUES (?, ?, ?, ?, ?)');
        const insertTask = db.prepare(`
          INSERT INTO tasks (id, row_id, name, start, end, color, tjm, etp, progress, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertObjective = db.prepare('INSERT INTO task_objectives (task_id, objective) VALUES (?, ?)');
        const insertDep = db.prepare('INSERT INTO task_deps (task_id, dep_task_id) VALUES (?, ?)');

        for (const row of data.rows) {
          insertRow.run(
            row.id,
            row.name || '',
            row.color,
            row.groupId || null,
            row.metier || null
          );

          if (row.tasks && row.tasks.length > 0) {
            for (const task of row.tasks) {
              insertTask.run(
                task.id,
                row.id,
                task.name,
                task.start,
                task.end,
                task.color,
                task.tjm || 0,
                task.etp || 0,
                task.progress || 0,
                task.status || null
              );

              if (task.objectives && task.objectives.length > 0) {
                for (const obj of task.objectives) {
                  insertObjective.run(task.id, obj);
                }
              }

              if (task.deps && task.deps.length > 0) {
                for (const dep of task.deps) {
                  insertDep.run(task.id, dep);
                }
              }
            }
          }
        }
      }

      // Insert milestones
      if (data.milestones && data.milestones.length > 0) {
        const insertMilestone = db.prepare('INSERT INTO milestones (id, name, date, color) VALUES (?, ?, ?, ?)');
        for (const ms of data.milestones) {
          insertMilestone.run(ms.id, ms.name, ms.date, ms.color);
        }
      }
    });

    saveAll();
    res.json({ success: true, message: 'Planning saved successfully' });
  } catch (error) {
    console.error('Error saving planning:', error);
    res.status(500).json({ error: 'Failed to save planning data' });
  }
});

// Export planning as JSON
app.get('/api/planning/export', (req, res) => {
  try {
    const state = db.prepare('SELECT * FROM planning_state ORDER BY id DESC LIMIT 1').get();

    if (!state) {
      return res.json({
        version: 2,
        exportedAt: new Date().toISOString(),
        zoom: 'week',
        viewStart: new Date().toISOString(),
        rows: [],
        groups: [],
        milestones: [],
        taskIdCounter: 0,
        groupIdCounter: 3,
        msIdCounter: 0
      });
    }

    const groups = db.prepare('SELECT * FROM groups ORDER BY id').all();
    const rows = db.prepare('SELECT * FROM rows ORDER BY id').all();
    const milestones = db.prepare('SELECT * FROM milestones ORDER BY id').all();

    const tasksStmt = db.prepare('SELECT * FROM tasks WHERE row_id = ? ORDER BY id');
    const objectivesStmt = db.prepare('SELECT objective FROM task_objectives WHERE task_id = ?');
    const depsStmt = db.prepare('SELECT dep_task_id FROM task_deps WHERE task_id = ?');

    rows.forEach(row => {
      row.tasks = tasksStmt.all(row.id);
      row.tasks.forEach(task => {
        task.objectives = objectivesStmt.all(task.id).map(o => o.objective);
        task.deps = depsStmt.all(task.id).map(d => d.dep_task_id);
      });
    });

    const exportData = {
      version: state.version,
      exportedAt: new Date().toISOString(),
      zoom: state.zoom,
      viewStart: state.view_start,
      rows: rows.map(r => ({
        id: r.id,
        name: r.name,
        color: r.color,
        groupId: r.group_id,
        metier: r.metier,
        tasks: r.tasks.map(t => ({
          id: t.id,
          name: t.name,
          start: t.start,
          end: t.end,
          color: t.color,
          tjm: t.tjm,
          etp: t.etp,
          progress: t.progress,
          status: t.status,
          objectives: t.objectives,
          deps: t.deps
        }))
      })),
      groups: groups.map(g => ({
        id: g.id,
        name: g.name,
        collapsed: g.collapsed === 1
      })),
      milestones: milestones.map(m => ({
        id: m.id,
        name: m.name,
        date: m.date,
        color: m.color
      })),
      taskIdCounter: state.task_id_counter,
      groupIdCounter: state.group_id_counter,
      msIdCounter: state.ms_id_counter
    };

    res.json(exportData);
  } catch (error) {
    console.error('Error exporting planning:', error);
    res.status(500).json({ error: 'Failed to export planning data' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Planning Gantt server running on http://localhost:${PORT}`);
  console.log(`   API available at http://localhost:${PORT}/api/planning`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  db.close();
  process.exit(0);
});
