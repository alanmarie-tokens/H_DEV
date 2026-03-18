import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { usePlanningStore } from '@/store/planningStore'
import { useViewStore } from '@/store/viewStore'
import { toYMD, todayDate } from '@/lib/dateUtils'
import { TASK_COLORS } from '@/constants/colors'
import styles from './MilestoneModal.module.css'

export function MilestoneModal() {
  const addMilestone    = usePlanningStore(s => s.addMilestone)
  const rows            = usePlanningStore(s => s.rows)
  const closeMilestone  = useViewStore(s => s.closeMilestoneModal)

  const [name, setName]   = useState('')
  const [date, setDate]   = useState(toYMD(todayDate()))
  const [color, setColor] = useState(TASK_COLORS[3])
  const [rowId, setRowId] = useState<number | undefined>(undefined)

  function handleSave() {
    if (!name.trim()) return
    addMilestone({ name: name.trim(), date, color, rowId })
    closeMilestone()
  }

  return (
    <Dialog.Root open onOpenChange={open => !open && closeMilestone()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>Nouveau jalon ⬦</Dialog.Title>

          <div className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Nom</label>
              <input
                className={styles.input}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nom du jalon…"
                autoFocus
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Date</label>
              <input
                type="date"
                className={styles.input}
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Couleur</label>
              <div className={styles.colorPicker}>
                {TASK_COLORS.map(c => (
                  <button
                    key={c}
                    className={`${styles.swatch} ${color === c ? styles.swatchSelected : ''}`}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Ligne (optionnel)</label>
              <select
                className={styles.input}
                value={rowId ?? ''}
                onChange={e => setRowId(e.target.value ? parseInt(e.target.value) : undefined)}
              >
                <option value="">— Aucune —</option>
                {rows.map(r => (
                  <option key={r.id} value={r.id}>{r.name || `Ligne #${r.id}`}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.actions}>
            <button className={styles.cancelBtn} onClick={closeMilestone}>Annuler</button>
            <button className={styles.saveBtn} onClick={handleSave} disabled={!name.trim()}>Créer</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
