import { useRef } from 'react'
import type { Group } from '@/types/planning'
import { usePlanningStore } from '@/store/planningStore'
import styles from './GroupHeader.module.css'

interface Props {
  group: Group
  labelW: number
  recapW: number
  colCount: number
}

export function GroupHeader({ group, labelW, recapW, colCount }: Props) {
  const toggleCollapse = usePlanningStore(s => s.toggleGroupCollapse)
  const updateGroup    = usePlanningStore(s => s.updateGroup)
  const deleteGroup    = usePlanningStore(s => s.deleteGroup)
  const addRow         = usePlanningStore(s => s.addRow)

  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={styles.header}>
      {/* Label cell */}
      <div className={styles.labelCell} style={{ width: labelW, minWidth: labelW }}>
        <button
          className={styles.toggleBtn}
          onClick={() => toggleCollapse(group.id)}
          title={group.collapsed ? 'Déplier' : 'Replier'}
        >
          {group.collapsed ? '▶' : '▼'}
        </button>
        <input
          ref={inputRef}
          className={styles.nameInput}
          value={group.name}
          placeholder="Nom du groupe…"
          onChange={e => updateGroup(group.id, { name: e.target.value })}
        />
        <button
          className={styles.actionBtn}
          onClick={() => { addRow(group.id); updateGroup(group.id, { collapsed: false }) }}
          title="Ajouter une ligne"
        >
          +
        </button>
        <button
          className={`${styles.actionBtn} ${styles.deleteBtn}`}
          onClick={() => deleteGroup(group.id)}
          title="Supprimer le groupe"
        >
          ×
        </button>
      </div>

      {/* Track area */}
      <div className={styles.track} />

      {/* Recap spacer */}
      <div style={{ width: recapW, minWidth: recapW }} />
    </div>
  )
}
