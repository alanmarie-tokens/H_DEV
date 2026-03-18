import { useViewStore } from '@/store/viewStore'
import { ZOOM_LEVELS, ZOOM_LABELS } from '@/constants/zoom'
import styles from './ZoomSelector.module.css'

export function ZoomSelector() {
  const zoom    = useViewStore(s => s.zoom)
  const setZoom = useViewStore(s => s.setZoom)

  return (
    <div className={styles.selector}>
      {ZOOM_LEVELS.map(z => (
        <button
          key={z}
          className={`${styles.btn} ${zoom === z ? styles.btnActive : ''}`}
          onClick={() => setZoom(z)}
          title={`Zoom : ${ZOOM_LABELS[z]}`}
        >
          {ZOOM_LABELS[z]}
        </button>
      ))}
    </div>
  )
}
