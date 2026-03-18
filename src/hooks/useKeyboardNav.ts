import { useEffect } from 'react'
import { useStore } from 'zustand'
import { useViewStore } from '@/store/viewStore'
import { usePlanningStore } from '@/store/planningStore'

function isInputFocused(): boolean {
  const tag = document.activeElement?.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' ||
    (document.activeElement as HTMLElement)?.isContentEditable === true
}

export function useKeyboardNav() {
  const navigatePrev  = useViewStore(s => s.navigatePrev)
  const navigateNext  = useViewStore(s => s.navigateNext)
  const goToToday     = useViewStore(s => s.goToToday)
  const toggleBacklog = useViewStore(s => s.toggleBacklog)
  const toggleFilter  = useViewStore(s => s.toggleFilter)

  // Undo/redo via zundo temporal store
  const { undo, redo } = useStore(usePlanningStore.temporal)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey

      if (ctrl) {
        if (e.key === 'z') { e.preventDefault(); undo(); return }
        if (e.key === 'y' || (e.shiftKey && e.key === 'z')) { e.preventDefault(); redo(); return }
        if (e.key === 'f') { e.preventDefault(); toggleFilter(); return }
        if (e.key === 's') { e.preventDefault(); return }  // save is automatic
        return
      }

      if (isInputFocused()) return

      if (e.key === 'ArrowLeft')  { navigatePrev(); return }
      if (e.key === 'ArrowRight') { navigateNext(); return }
      if (e.key === 't' || e.key === 'T') { goToToday(); return }
      if (e.key === 'b' || e.key === 'B') { toggleBacklog(); return }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigatePrev, navigateNext, goToToday, toggleBacklog, toggleFilter, undo, redo])
}
