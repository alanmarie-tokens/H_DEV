import { useReducer, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { usePlanningStore } from '@/store/planningStore'
import { useViewStore } from '@/store/viewStore'
import { pctToDate, viewRangeStart, viewRangeEnd } from '@/lib/viewGeometry'
import { toYMD, addDays, snapToZoom } from '@/lib/dateUtils'
import { TASK_COLORS, TASK_STATUSES } from '@/constants/colors'
import type { Task, ViewColumn, ZoomLevel } from '@/types/planning'
import styles from './TaskModal.module.css'

type FormState = Omit<Task, 'id'>

type Action =
  | { type: 'set'; key: keyof FormState; value: any }
  | { type: 'reset'; task: FormState }

function reducer(state: FormState, action: Action): FormState {
  if (action.type === 'reset') return action.task
  return { ...state, [action.key]: action.value }
}

interface Props {
  rowId: number
  editTaskId: number | null
  clickPercent: number
  viewColumns: ViewColumn[]
  zoom: ZoomLevel
}

export function TaskModal({ rowId, editTaskId, clickPercent, viewColumns, zoom }: Props) {
  const addTask    = usePlanningStore(s => s.addTask)
  const updateTask = usePlanningStore(s => s.updateTask)
  const deleteTask = usePlanningStore(s => s.deleteTask)
  const rows       = usePlanningStore(s => s.rows)
  const closeModal = useViewStore(s => s.closeModal)

  const row        = rows.find(r => r.id === rowId)
  const editTask   = editTaskId ? row?.tasks.find(t => t.id === editTaskId) : undefined

  const rangeStart = viewRangeStart(viewColumns)
  const rangeEnd   = viewRangeEnd(viewColumns, zoom)

  function defaultForm(): FormState {
    if (editTask) {
      return { ...editTask }
    }
    const clickDate = snapToZoom(pctToDate(clickPercent, rangeStart, rangeEnd), zoom)
    const endDate   = addDays(clickDate, 5)
    return {
      name: '',
      start: toYMD(clickDate),
      end: toYMD(endDate),
      color: TASK_COLORS[0],
      status: null,
      progress: 0,
      objectives: [],
      subtasks: [],
      deps: [],
      batiments: [],
    }
  }

  const [form, dispatch] = useReducer(reducer, undefined, defaultForm)

  useEffect(() => {
    dispatch({ type: 'reset', task: defaultForm() })
  }, [editTaskId, rowId])

  function handleSave() {
    if (!form.name.trim()) return
    if (editTaskId) {
      updateTask(rowId, editTaskId, form)
    } else {
      addTask(rowId, form)
    }
    closeModal()
  }

  function handleDelete() {
    if (editTaskId) deleteTask(rowId, editTaskId)
    closeModal()
  }

  return (
    <Dialog.Root open onOpenChange={open => !open && closeModal()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>
            {editTaskId ? 'Modifier la tâche' : 'Nouvelle tâche'}
          </Dialog.Title>

          <div className={styles.form}>
            {/* Name */}
            <div className={styles.field}>
              <label className={styles.label}>Nom</label>
              <input
                className={styles.input}
                value={form.name}
                onChange={e => dispatch({ type: 'set', key: 'name', value: e.target.value })}
                placeholder="Nom de la tâche…"
                autoFocus
              />
            </div>

            {/* Dates */}
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Début</label>
                <input
                  type="date"
                  className={styles.input}
                  value={form.start}
                  onChange={e => dispatch({ type: 'set', key: 'start', value: e.target.value })}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Fin</label>
                <input
                  type="date"
                  className={styles.input}
                  value={form.end}
                  onChange={e => dispatch({ type: 'set', key: 'end', value: e.target.value })}
                />
              </div>
            </div>

            {/* Color */}
            <div className={styles.field}>
              <label className={styles.label}>Couleur</label>
              <div className={styles.colorPicker}>
                {TASK_COLORS.map(c => (
                  <button
                    key={c}
                    className={`${styles.colorSwatch} ${form.color === c ? styles.colorSwatchSelected : ''}`}
                    style={{ background: c }}
                    onClick={() => dispatch({ type: 'set', key: 'color', value: c })}
                  />
                ))}
              </div>
            </div>

            {/* Status */}
            <div className={styles.field}>
              <label className={styles.label}>Statut</label>
              <div className={styles.statusPicker}>
                {TASK_STATUSES.map(st => (
                  <button
                    key={st.id}
                    className={`${styles.statusBtn} ${form.status === st.id ? styles.statusBtnActive : ''}`}
                    style={form.status === st.id ? { borderColor: st.color, color: st.color } : undefined}
                    onClick={() => dispatch({ type: 'set', key: 'status', value: form.status === st.id ? null : st.id })}
                  >
                    {st.icon} {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ETP & TJM */}
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>ETP</label>
                <input
                  type="number"
                  className={styles.input}
                  value={form.etp ?? ''}
                  min={0} max={1} step={0.1}
                  onChange={e => dispatch({ type: 'set', key: 'etp', value: parseFloat(e.target.value) || undefined })}
                  placeholder="1.0"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>TJM (€)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={form.tjm ?? ''}
                  min={0}
                  onChange={e => dispatch({ type: 'set', key: 'tjm', value: parseFloat(e.target.value) || undefined })}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Progress */}
            <div className={styles.field}>
              <label className={styles.label}>Avancement — {form.progress ?? 0}%</label>
              <input
                type="range"
                className={styles.range}
                value={form.progress ?? 0}
                min={0} max={100}
                onChange={e => dispatch({ type: 'set', key: 'progress', value: parseInt(e.target.value) })}
              />
            </div>

            {/* Notes */}
            <div className={styles.field}>
              <label className={styles.label}>Notes</label>
              <textarea
                className={styles.textarea}
                value={form.notes ?? ''}
                onChange={e => dispatch({ type: 'set', key: 'notes', value: e.target.value })}
                placeholder="Notes…"
                rows={3}
              />
            </div>
          </div>

          <div className={styles.actions}>
            {editTaskId && (
              <button className={styles.deleteBtn} onClick={handleDelete}>Supprimer</button>
            )}
            <button className={styles.cancelBtn} onClick={closeModal}>Annuler</button>
            <button className={styles.saveBtn} onClick={handleSave} disabled={!form.name.trim()}>
              {editTaskId ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
