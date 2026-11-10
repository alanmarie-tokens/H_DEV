import { useFirebaseSync } from '@/firebase/useFirebaseSync'
import { useKeyboardNav } from '@/hooks/useKeyboardNav'
import { useViewStore } from '@/store/viewStore'
import { AppHeader } from '@/components/layout/AppHeader'
import { GanttView } from '@/components/gantt/GanttView'
import { ReportingView } from '@/components/reporting/ReportingView'
import { ListView } from '@/components/list/ListView'
import styles from './App.module.css'

export function App() {
  useFirebaseSync()
  useKeyboardNav()

  const activeTab = useViewStore(s => s.activeTab)

  return (
    <div className={styles.app}>
      <AppHeader />
      <main className={styles.main}>
        {activeTab === 'gantt'      && <GanttView />}
        {activeTab === 'reporting'  && <ReportingView />}
        {activeTab === 'list'       && <ListView />}
      </main>
    </div>
  )
}
