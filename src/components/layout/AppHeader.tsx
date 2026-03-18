import { useStore } from 'zustand'
import { useViewStore } from '@/store/viewStore'
import { usePlanningStore } from '@/store/planningStore'
import { TemporalNav } from '@/components/temporal/TemporalNav'
import { ZoomSelector } from '@/components/temporal/ZoomSelector'
import styles from './AppHeader.module.css'

export function AppHeader() {
  const activeTab      = useViewStore(s => s.activeTab)
  const setActiveTab   = useViewStore(s => s.setActiveTab)
  const toggleFilter   = useViewStore(s => s.toggleFilter)
  const toggleHistogram = useViewStore(s => s.toggleHistogram)
  const histogramVisible = useViewStore(s => s.histogramVisible)
  const toggleBacklog  = useViewStore(s => s.toggleBacklog)
  const backlogVisible = useViewStore(s => s.backlogVisible)
  const syncStatus     = useViewStore(s => s.syncStatus)
  const usersOnline    = useViewStore(s => s.usersOnline)
  const addGroup       = usePlanningStore(s => s.addGroup)
  const addMilestone   = useViewStore(s => s.openMilestoneModal)
  const { undo, redo, pastStates, futureStates } = useStore(usePlanningStore.temporal)

  const onlineCount = Object.keys(usersOnline).length

  const SYNC_LABELS = {
    connecting: 'Connexion…',
    connected:  'Connecté',
    synced:     'Synchronisé',
    offline:    'Hors ligne',
    error:      'Erreur sync',
  }

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {/* Logo */}
        <div className={styles.logo}>
          <span className={styles.logoIcon}>◆</span>
          <span className={styles.logoText}>Planning</span>
        </div>

        {/* Tab bar */}
        <nav className={styles.tabs}>
          {(['gantt','dashboard','list'] as const).map(tab => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'gantt' ? 'Gantt' : tab === 'dashboard' ? 'Dashboard' : 'Liste'}
            </button>
          ))}
        </nav>
      </div>

      {/* Center — only on Gantt tab */}
      {activeTab === 'gantt' && (
        <div className={styles.center}>
          <TemporalNav />
          <ZoomSelector />
        </div>
      )}

      <div className={styles.right}>
        {activeTab === 'gantt' && (
          <>
            <button className={styles.iconBtn} onClick={() => undo()} disabled={pastStates.length === 0} title="Annuler (Ctrl+Z)">↩</button>
            <button className={styles.iconBtn} onClick={() => redo()} disabled={futureStates.length === 0} title="Rétablir (Ctrl+Y)">↪</button>
            <div className={styles.separator} />
            <button className={styles.iconBtn} onClick={toggleFilter} title="Filtrer (Ctrl+F)">⚡</button>
            <button className={`${styles.iconBtn} ${histogramVisible ? styles.iconBtnActive : ''}`} onClick={toggleHistogram} title="Charge ETP">≡</button>
            <button className={`${styles.iconBtn} ${backlogVisible ? styles.iconBtnActive : ''}`} onClick={toggleBacklog} title="Backlog (B)">☰</button>
            <div className={styles.separator} />
            <button className={styles.addBtn} onClick={addGroup}>+ Groupe</button>
            <button className={styles.addBtn} onClick={addMilestone}>⬦ Jalon</button>
          </>
        )}

        <div className={styles.separator} />

        {/* Users online */}
        {onlineCount > 0 && (
          <div className={styles.users}>
            {Object.entries(usersOnline).slice(0, 3).map(([clientId, u]) => (
              <div
                key={clientId}
                className={styles.userDot}
                style={{ background: u.color }}
                title={u.name}
              />
            ))}
            {onlineCount > 3 && <span className={styles.userExtra}>+{onlineCount - 3}</span>}
          </div>
        )}

        {/* Sync status */}
        <div className={`${styles.sync} ${styles[`sync_${syncStatus}`]}`}>
          <span className={styles.syncDot} />
          <span className={styles.syncLabel}>{SYNC_LABELS[syncStatus]}</span>
        </div>
      </div>
    </header>
  )
}
