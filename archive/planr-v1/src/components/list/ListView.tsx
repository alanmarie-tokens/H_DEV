import { useMemo, useState } from 'react'
import { usePlanningStore } from '@/store/planningStore'
import { useViewStore } from '@/store/viewStore'
import { taskCost, fmtCost } from '@/lib/taskCost'
import { TASK_STATUSES } from '@/constants/colors'
import type { Task, Row } from '@/types/planning'
import styles from './ListView.module.css'

type SortKey = 'name' | 'start' | 'end' | 'status' | 'cost'
type SortDir = 'asc' | 'desc'

interface FlatTask { task: Task; row: Row }

export function ListView() {
  const rows       = usePlanningStore(s => s.rows)
  const filterState = useViewStore(s => s.filterState)
  const openModal  = useViewStore(s => s.openTaskModal)

  const [sortKey, setSortKey] = useState<SortKey>('start')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const flatTasks = useMemo<FlatTask[]>(() => {
    const items: FlatTask[] = []
    rows.forEach(row => row.tasks.forEach(task => items.push({ task, row })))

    // Filter
    const { text, userStatus } = filterState
    const filtered = items.filter(({ task, row }) => {
      if (text && !task.name.toLowerCase().includes(text.toLowerCase()) &&
          !row.name.toLowerCase().includes(text.toLowerCase())) return false
      if (userStatus && task.status !== userStatus) return false
      return true
    })

    // Sort
    return filtered.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name')   cmp = a.task.name.localeCompare(b.task.name)
      if (sortKey === 'start')  cmp = a.task.start.localeCompare(b.task.start)
      if (sortKey === 'end')    cmp = a.task.end.localeCompare(b.task.end)
      if (sortKey === 'status') cmp = (a.task.status ?? '').localeCompare(b.task.status ?? '')
      if (sortKey === 'cost')   cmp = taskCost(a.task).cost - taskCost(b.task).cost
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, filterState, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const statusById = Object.fromEntries(TASK_STATUSES.map(s => [s.id, s]))

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {([['name','Tâche'],['start','Début'],['end','Fin'],['status','Statut'],['cost','Coût']] as [SortKey,string][]).map(([key, label]) => (
              <th
                key={key}
                className={`${styles.th} ${sortKey === key ? styles.thActive : ''}`}
                onClick={() => handleSort(key)}
              >
                {label} {sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
            ))}
            <th className={styles.th}>Ligne</th>
          </tr>
        </thead>
        <tbody>
          {flatTasks.map(({ task, row }) => {
            const st = task.status ? statusById[task.status] : null
            const { cost } = taskCost(task)
            return (
              <tr
                key={task.id}
                className={styles.tr}
                onDoubleClick={() => openModal(row.id, 0, task.id)}
              >
                <td className={styles.td}>
                  <div className={styles.taskName}>
                    <div className={styles.taskColor} style={{ background: task.color }} />
                    {task.name}
                  </div>
                </td>
                <td className={`${styles.td} ${styles.mono}`}>{task.start}</td>
                <td className={`${styles.td} ${styles.mono}`}>{task.end}</td>
                <td className={styles.td}>
                  {st && (
                    <span className={styles.status} style={{ color: st.color }}>
                      {st.icon} {st.label}
                    </span>
                  )}
                </td>
                <td className={`${styles.td} ${styles.mono}`}>{cost > 0 ? fmtCost(cost) : '—'}</td>
                <td className={styles.td}>
                  <span className={styles.rowName} style={{ borderLeftColor: row.color }}>
                    {row.name || `Ligne #${row.id}`}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {flatTasks.length === 0 && (
        <div className={styles.empty}>Aucune tâche</div>
      )}
    </div>
  )
}
