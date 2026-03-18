import { useState } from 'react'
import { usePlanningStore } from '@/store/planningStore'
import { TASK_COLORS } from '@/constants/colors'
import styles from './BacklogPanel.module.css'

export function BacklogPanel() {
  const backlog       = usePlanningStore(s => s.backlog)
  const addBacklogItem = usePlanningStore(s => s.addBacklogItem)
  const deleteBacklogItem = usePlanningStore(s => s.deleteBacklogItem)

  const [newName, setNewName] = useState('')

  function handleAdd() {
    if (!newName.trim()) return
    addBacklogItem({
      name: newName.trim(),
      color: TASK_COLORS[backlog.length % TASK_COLORS.length],
    })
    setNewName('')
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Backlog</span>
        <span className={styles.count}>{backlog.length}</span>
      </div>

      <div className={styles.list}>
        {backlog.map(item => (
          <div key={item.id} className={styles.item}>
            <div className={styles.dot} style={{ background: item.color }} />
            <span className={styles.name}>{item.name}</span>
            <button
              className={styles.deleteBtn}
              onClick={() => deleteBacklogItem(item.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className={styles.addRow}>
        <input
          className={styles.addInput}
          placeholder="Ajouter au backlog…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button className={styles.addBtn} onClick={handleAdd}>+</button>
      </div>
    </div>
  )
}
