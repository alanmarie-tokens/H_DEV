import { useMemo } from 'react'
import { usePlanningStore } from '@/store/planningStore'
import { useViewStore } from '@/store/viewStore'
import { taskCost, fmtCost, fmtEtp } from '@/lib/taskCost'
import { TASK_STATUSES, metierColor } from '@/constants/colors'
import type { Task, Row, Group, ReportingSubTab } from '@/types/planning'
import styles from './ReportingView.module.css'

/* ── helpers ─────────────────────────────────────────────── */

interface GroupStats {
  name: string
  tasks: number
  cost: number
  days: number
  etpSum: number
  avgEtp: number
  avgProgress: number
  byStatus: Record<string, number>
}

function aggregateTasks(tasks: Task[]): Omit<GroupStats, 'name'> {
  let cost = 0, days = 0, etpSum = 0, progressSum = 0
  const byStatus: Record<string, number> = {}

  for (const t of tasks) {
    const tc = taskCost(t)
    cost += tc.cost
    days += tc.days
    etpSum += tc.days * tc.etp
    progressSum += t.progress ?? 0
    const st = t.status ?? 'todo'
    byStatus[st] = (byStatus[st] ?? 0) + 1
  }

  const avgEtp = days > 0 ? etpSum / days : 0
  const avgProgress = tasks.length > 0 ? progressSum / tasks.length : 0

  return { tasks: tasks.length, cost, days, etpSum, avgEtp, avgProgress, byStatus }
}

function collectAllTasks(rows: Row[]): Task[] {
  return rows.flatMap(r => r.tasks)
}

/* ── sub-components ──────────────────────────────────────── */

function KpiCards({ allTasks }: { allTasks: Task[] }) {
  const stats = useMemo(() => aggregateTasks(allTasks), [allTasks])

  const kpis = [
    { label: 'Tâches', value: String(stats.tasks), sub: 'total' },
    { label: 'Coût total', value: fmtCost(stats.cost), sub: 'estimé' },
    { label: 'Charge', value: fmtEtp(stats.avgEtp), sub: 'moyenne' },
    { label: 'Jours', value: String(stats.days), sub: 'travaillés' },
    { label: 'Progression', value: Math.round(stats.avgProgress) + '%', sub: 'moyenne' },
  ]

  return (
    <div className={styles.kpis}>
      {kpis.map(kpi => (
        <div key={kpi.label} className={styles.kpi}>
          <span className={styles.kpiLabel}>{kpi.label}</span>
          <span className={styles.kpiValue}>{kpi.value}</span>
          <span className={styles.kpiSub}>{kpi.sub}</span>
        </div>
      ))}
    </div>
  )
}

function StatusBars({ byStatus, total }: { byStatus: Record<string, number>; total: number }) {
  return (
    <div className={styles.statusBars}>
      {TASK_STATUSES.map(st => {
        const count = byStatus[st.id] ?? 0
        const pct = total > 0 ? (count / total) * 100 : 0
        return (
          <div key={st.id} className={styles.statusRow}>
            <span className={styles.statusIcon}>{st.icon}</span>
            <span className={styles.statusLabel}>{st.label}</span>
            <div className={styles.statusBar}>
              <div className={styles.statusBarFill} style={{ width: `${pct}%`, background: st.color }} />
            </div>
            <span className={styles.statusCount}>{count}</span>
          </div>
        )
      })}
    </div>
  )
}

function ProgressBar({ value }: { value: number }) {
  const color = value >= 80 ? '#22c55e' : value >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div className={styles.progressBar}>
      <div className={styles.progressFill} style={{ width: `${value}%`, background: color }} />
      <span className={styles.progressText}>{Math.round(value)}%</span>
    </div>
  )
}

function StatsCard({ stat }: { stat: GroupStats }) {
  return (
    <div className={styles.statsCard}>
      <div className={styles.statsCardHeader}>
        <h4 className={styles.statsCardTitle}>{stat.name}</h4>
        <span className={styles.statsCardBadge}>{stat.tasks} tâche{stat.tasks > 1 ? 's' : ''}</span>
      </div>
      <div className={styles.statsCardMetrics}>
        <div className={styles.metric}>
          <span className={styles.metricValue}>{fmtCost(stat.cost)}</span>
          <span className={styles.metricLabel}>Coût</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricValue}>{fmtEtp(stat.avgEtp)}</span>
          <span className={styles.metricLabel}>Charge</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricValue}>{stat.days}j</span>
          <span className={styles.metricLabel}>Jours</span>
        </div>
      </div>
      <ProgressBar value={stat.avgProgress} />
      <div className={styles.statsCardStatus}>
        {TASK_STATUSES.map(st => {
          const count = stat.byStatus[st.id] ?? 0
          if (count === 0) return null
          return (
            <span key={st.id} className={styles.miniStatus} style={{ color: st.color }}>
              {st.icon} {count}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/* ── sections ────────────────────────────────────────────── */

function CategorieSection({ rows, groups }: { rows: Row[]; groups: Group[] }) {
  const stats = useMemo(() => {
    const groupMap = new Map<number, Group>()
    groups.forEach(g => groupMap.set(g.id, g))

    const buckets = new Map<string, Task[]>()

    for (const row of rows) {
      const groupName = row.groupId != null ? (groupMap.get(row.groupId)?.name ?? 'Sans catégorie') : 'Sans catégorie'
      const existing = buckets.get(groupName) ?? []
      existing.push(...row.tasks)
      buckets.set(groupName, existing)
    }

    const result: GroupStats[] = []
    for (const [name, tasks] of buckets) {
      if (tasks.length === 0) continue
      result.push({ name, ...aggregateTasks(tasks) })
    }
    return result.sort((a, b) => b.cost - a.cost)
  }, [rows, groups])

  if (stats.length === 0) return <div className={styles.empty}>Aucune catégorie avec des tâches</div>

  return (
    <div className={styles.cardsGrid}>
      {stats.map(s => <StatsCard key={s.name} stat={s} />)}
    </div>
  )
}

function LigneSection({ rows }: { rows: Row[] }) {
  const stats = useMemo(() => {
    const result: GroupStats[] = []
    for (const row of rows) {
      if (row.tasks.length === 0) continue
      result.push({ name: row.name, ...aggregateTasks(row.tasks) })
    }
    return result.sort((a, b) => b.cost - a.cost)
  }, [rows])

  if (stats.length === 0) return <div className={styles.empty}>Aucune ligne avec des tâches</div>

  return (
    <div className={styles.cardsGrid}>
      {stats.map(s => <StatsCard key={s.name} stat={s} />)}
    </div>
  )
}

function MetiersSection({ rows }: { rows: Row[] }) {
  const stats = useMemo(() => {
    const buckets = new Map<string, Task[]>()

    for (const row of rows) {
      for (const task of row.tasks) {
        const metier = task.metier || row.metier || 'Non défini'
        const existing = buckets.get(metier) ?? []
        existing.push(task)
        buckets.set(metier, existing)
      }
    }

    const result: (GroupStats & { color: { bg: string; fg: string } | null })[] = []
    for (const [name, tasks] of buckets) {
      if (tasks.length === 0) continue
      result.push({ name, ...aggregateTasks(tasks), color: metierColor(name) })
    }
    return result.sort((a, b) => b.cost - a.cost)
  }, [rows])

  if (stats.length === 0) return <div className={styles.empty}>Aucun métier défini</div>

  return (
    <div className={styles.cardsGrid}>
      {stats.map(s => (
        <div key={s.name} className={styles.statsCard}>
          <div className={styles.statsCardHeader}>
            {s.color ? (
              <span className={styles.metierBadge} style={{ background: s.color.bg, color: s.color.fg }}>
                {s.name}
              </span>
            ) : (
              <h4 className={styles.statsCardTitle}>{s.name}</h4>
            )}
            <span className={styles.statsCardBadge}>{s.tasks} tâche{s.tasks > 1 ? 's' : ''}</span>
          </div>
          <div className={styles.statsCardMetrics}>
            <div className={styles.metric}>
              <span className={styles.metricValue}>{fmtCost(s.cost)}</span>
              <span className={styles.metricLabel}>Coût</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricValue}>{fmtEtp(s.avgEtp)}</span>
              <span className={styles.metricLabel}>Charge</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricValue}>{s.days}j</span>
              <span className={styles.metricLabel}>Jours</span>
            </div>
          </div>
          <ProgressBar value={s.avgProgress} />
          <div className={styles.statsCardStatus}>
            {TASK_STATUSES.map(st => {
              const count = s.byStatus[st.id] ?? 0
              if (count === 0) return null
              return (
                <span key={st.id} className={styles.miniStatus} style={{ color: st.color }}>
                  {st.icon} {count}
                </span>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── main ────────────────────────────────────────────────── */

const SUB_TABS: { id: ReportingSubTab; label: string }[] = [
  { id: 'categorie', label: 'Catégorie' },
  { id: 'ligne', label: 'Ligne' },
  { id: 'metiers', label: 'Métiers' },
]

export function ReportingView() {
  const rows = usePlanningStore(s => s.rows)
  const groups = usePlanningStore(s => s.groups)
  const subTab = useViewStore(s => s.reportingSubTab)
  const setSubTab = useViewStore(s => s.setReportingSubTab)

  const allTasks = useMemo(() => collectAllTasks(rows), [rows])
  const globalStats = useMemo(() => aggregateTasks(allTasks), [allTasks])

  return (
    <div className={styles.reporting}>
      {/* ── Général : KPIs + Status ── */}
      <KpiCards allTasks={allTasks} />
      <StatusBars byStatus={globalStats.byStatus} total={globalStats.tasks} />

      {/* ── Sub-tabs panel ── */}
      <div className={styles.panel}>
        <nav className={styles.subTabs}>
          {SUB_TABS.map(tab => (
            <button
              key={tab.id}
              className={`${styles.subTab} ${subTab === tab.id ? styles.subTabActive : ''}`}
              onClick={() => setSubTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className={styles.panelContent}>
          {subTab === 'categorie' && <CategorieSection rows={rows} groups={groups} />}
          {subTab === 'ligne' && <LigneSection rows={rows} />}
          {subTab === 'metiers' && <MetiersSection rows={rows} />}
        </div>
      </div>
    </div>
  )
}
