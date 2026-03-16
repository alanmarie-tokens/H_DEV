const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Initialize database
const db = new Database('planning.db');

// Create schema
db.exec(`
  CREATE TABLE IF NOT EXISTS planning_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version INTEGER NOT NULL,
    zoom TEXT NOT NULL,
    view_start TEXT NOT NULL,
    task_id_counter INTEGER NOT NULL,
    group_id_counter INTEGER NOT NULL,
    ms_id_counter INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    collapsed INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS rows (
    id INTEGER PRIMARY KEY,
    name TEXT,
    color TEXT NOT NULL,
    group_id INTEGER,
    metier TEXT,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY,
    row_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    start TEXT NOT NULL,
    end TEXT NOT NULL,
    color TEXT NOT NULL,
    tjm REAL DEFAULT 0,
    etp REAL DEFAULT 0,
    progress INTEGER DEFAULT 0,
    status TEXT,
    FOREIGN KEY (row_id) REFERENCES rows(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS task_objectives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    objective TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS task_deps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    dep_task_id INTEGER NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (dep_task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS milestones (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    color TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_row_id ON tasks(row_id);
  CREATE INDEX IF NOT EXISTS idx_rows_group_id ON rows(group_id);
  CREATE INDEX IF NOT EXISTS idx_task_objectives_task_id ON task_objectives(task_id);
  CREATE INDEX IF NOT EXISTS idx_task_deps_task_id ON task_deps(task_id);
`);

console.log('✓ Database schema created');

// Load initial data from JSON if it exists
const jsonPath = path.join(__dirname, '..', 'planning_2026-03-14.json');
if (fs.existsSync(jsonPath)) {
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  // Check if database is empty
  const stateCount = db.prepare('SELECT COUNT(*) as count FROM planning_state').get();

  if (stateCount.count === 0) {
    console.log('Loading initial data from planning_2026-03-14.json...');

    // Insert planning state
    const insertState = db.prepare(`
      INSERT INTO planning_state (version, zoom, view_start, task_id_counter, group_id_counter, ms_id_counter, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertState.run(
      data.version || 2,
      data.zoom || 'week',
      data.viewStart || new Date().toISOString(),
      data.taskIdCounter || 0,
      data.groupIdCounter || 3,
      data.msIdCounter || 0,
      data.exportedAt || new Date().toISOString()
    );

    // Insert groups
    if (data.groups && data.groups.length > 0) {
      const insertGroup = db.prepare('INSERT INTO groups (id, name, collapsed) VALUES (?, ?, ?)');
      const insertGroups = db.transaction((groups) => {
        for (const group of groups) {
          insertGroup.run(group.id, group.name, group.collapsed ? 1 : 0);
        }
      });
      insertGroups(data.groups);
      console.log(`✓ Inserted ${data.groups.length} groups`);
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

      const insertAll = db.transaction((rows) => {
        for (const row of rows) {
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

              // Insert objectives if they exist
              if (task.objectives && task.objectives.length > 0) {
                for (const obj of task.objectives) {
                  insertObjective.run(task.id, obj);
                }
              }

              // Insert dependencies if they exist
              if (task.deps && task.deps.length > 0) {
                for (const dep of task.deps) {
                  insertDep.run(task.id, dep);
                }
              }
            }
          }
        }
      });

      insertAll(data.rows);
      console.log(`✓ Inserted ${data.rows.length} rows with tasks`);
    }

    // Insert milestones
    if (data.milestones && data.milestones.length > 0) {
      const insertMilestone = db.prepare('INSERT INTO milestones (id, name, date, color) VALUES (?, ?, ?, ?)');
      const insertMilestones = db.transaction((milestones) => {
        for (const ms of milestones) {
          insertMilestone.run(ms.id, ms.name, ms.date, ms.color);
        }
      });
      insertMilestones(data.milestones);
      console.log(`✓ Inserted ${data.milestones.length} milestones`);
    }

    console.log('✓ Initial data loaded successfully');
  } else {
    console.log('Database already contains data, skipping initial load');
  }
}

db.close();
console.log('✓ Database initialization complete');
