import { useMemo } from 'react'
import { useViewStore } from '@/store/viewStore'
import { usePlanningStore } from '@/store/planningStore'
import { TASK_STATUSES } from '@/constants/colors'
import styles from './FilterBar.module.css'

export function FilterBar() {
  const filterState = useViewStore(s => s.filterState)
  const setFilter   = useViewStore(s => s.setFilter)
  const resetFilter = useViewStore(s => s.resetFilter)
  const rows        = usePlanningStore(s => s.rows)

  const batiments = useMemo(() => {
    const set = new Set<string>()
    rows.forEach(r => r.tasks.forEach(t => t.batiments?.forEach(b => b && set.add(b))))
    return [...set].sort()
  }, [rows])

  return (
    <div className={styles.bar}>
      <input
        className={styles.search}
        placeholder="Rechercher…"
        value={filterState.text}
        onChange={e => setFilter({ text: e.target.value })}
        autoFocus
      />

      <div className={styles.chips}>
        {(['active','upcoming','done'] as const).map(s => (
          <button
            key={s}
            className={`${styles.chip} ${filterState.status === s ? styles.chipActive : ''}`}
            onClick={() => setFilter({ status: filterState.status === s ? null : s })}
          >
            {s === 'active' ? 'En cours' : s === 'upcoming' ? 'À venir' : 'Terminé'}
          </button>
        ))}
      </div>

      <div className={styles.chips}>
        {TASK_STATUSES.map(st => (
          <button
            key={st.id}
            className={`${styles.chip} ${filterState.userStatus === st.id ? styles.chipActive : ''}`}
            onClick={() => setFilter({ userStatus: filterState.userStatus === st.id ? null : st.id })}
          >
            {st.icon} {st.label}
          </button>
        ))}
      </div>

      {batiments.length > 0 && (
        <div className={styles.chips}>
          {batiments.map(b => (
            <button
              key={b}
              className={`${styles.chip} ${filterState.batiment === b ? styles.chipActive : ''}`}
              onClick={() => setFilter({ batiment: filterState.batiment === b ? null : b })}
            >
              {b}
            </button>
          ))}
        </div>
      )}

      <button className={styles.resetBtn} onClick={resetFilter}>Réinitialiser</button>
    </div>
  )
}
