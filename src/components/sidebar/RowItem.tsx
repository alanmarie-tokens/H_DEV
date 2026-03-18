import { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'
import type { Row } from '@/types/planning'
import { usePlanningStore } from '@/store/planningStore'
import { useViewStore } from '@/store/viewStore'
import { metierColor } from '@/constants/colors'
import styles from './RowItem.module.css'

interface Props {
  row: Row
  dragListeners?: SyntheticListenerMap
}

export function RowItem({ row, dragListeners }: Props) {
  const updateRow = usePlanningStore(s => s.updateRow)
  const deleteRow = usePlanningStore(s => s.deleteRow)
  const addTask   = usePlanningStore(s => s.addTask)
  const sidebarCollapsed = useViewStore(s => s.sidebarCollapsed)

  const mc = metierColor(row.metier ?? '')

  if (sidebarCollapsed) {
    return (
      <div className={styles.itemCollapsed}>
        <div className={styles.colorDot} style={{ background: row.color }} />
      </div>
    )
  }

  return (
    <div className={styles.item}>
      {/* Drag grip */}
      <div className={styles.grip} {...dragListeners} title="Réordonner">
        ⠿
      </div>

      {/* Color dot */}
      <div className={styles.colorDot} style={{ background: row.color }} />

      {/* Name input */}
      <input
        className={styles.nameInput}
        value={row.name}
        placeholder="Nom de la ligne…"
        onChange={e => updateRow(row.id, { name: e.target.value })}
      />

      {/* Metier badge */}
      {row.metier && mc && (
        <span
          className={styles.metierBadge}
          style={{ background: mc.bg, color: mc.fg }}
        >
          {row.metier}
        </span>
      )}

      {/* Delete */}
      <button
        className={styles.deleteBtn}
        onClick={() => deleteRow(row.id)}
        title="Supprimer la ligne"
      >
        ×
      </button>
    </div>
  )
}
