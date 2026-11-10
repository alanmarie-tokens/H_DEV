import { useMemo } from 'react'
import { usePlanningStore } from '@/store/planningStore'
import { taskCost, fmtCost, fmtEtp } from '@/lib/taskCost'
import { fromYMD, todayDate } from '@/lib/dateUtils'
import { TASK_STATUSES } from '@/constants/colors'
import styles from './DashboardView.module.css'

export function DashboardView() {
  const rows = usePlanningStore(s => s.rows)

  const stats = useMemo(() => {
    let totalTasks = 0, totalCost = 0, totalDays = 0, etpSum = 0
    const byStatus: Record<string, number> = {}
    const today = todayDate()

    rows.forEach(row => {
      row.tasks.forEach(task => {
        totalTasks++
        const { cost, days, etp } = taskCost(task)
        totalCost += cost
        totalDays += days
        etpSum += days * etp

        const st = task.status ?? 'todo'
        byStatus[st] = (byStatus[st] ?? 0) + 1
      })
    })

    const avgEtp = totalDays > 0 ? etpSum / totalDays : 0
    return { totalTasks, totalCost, totalDays, avgEtp, byStatus }
  }, [rows])

  const kpis = [
    { label: 'Tâches',    value: String(stats.totalTasks), sub: 'total' },
    { label: 'Coût total', value: fmtCost(stats.totalCost), sub: 'estimé' },
    { label: 'Charge',    value: fmtEtp(stats.avgEtp),    sub: 'moyenne' },
    { label: 'Jours',     value: String(stats.totalDays), sub: 'travaillés' },
  ]

  return (
    <div className={styles.dashboard}>
      <div className={styles.kpis}>
        {kpis.map(kpi => (
          <div key={kpi.label} className={styles.kpi}>
            <span className={styles.kpiLabel}>{kpi.label}</span>
            <span className={styles.kpiValue}>{kpi.value}</span>
            <span className={styles.kpiSub}>{kpi.sub}</span>
          </div>
        ))}
      </div>

      <div className={styles.statusChart}>
        <h3 className={styles.sectionTitle}>Par statut</h3>
        {TASK_STATUSES.map(st => {
          const count = stats.byStatus[st.id] ?? 0
          const pct = stats.totalTasks > 0 ? (count / stats.totalTasks) * 100 : 0
          return (
            <div key={st.id} className={styles.statusRow}>
              <span className={styles.statusIcon}>{st.icon}</span>
              <span className={styles.statusLabel}>{st.label}</span>
              <div className={styles.statusBar}>
                <div
                  className={styles.statusBarFill}
                  style={{ width: `${pct}%`, background: st.color }}
                />
              </div>
              <span className={styles.statusCount}>{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
