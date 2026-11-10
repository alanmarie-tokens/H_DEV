import { useEffect, useRef } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, onValue, set, get, off } from 'firebase/database'
import { FIREBASE_CONFIG, DB_PLANNING_PATH, DB_USER_SETTINGS_PATH } from './config'
import { usePlanningStore } from '@/store/planningStore'
import { useViewStore } from '@/store/viewStore'
import type { PlanningDocument } from '@/types/planning'

let _cachedClientId: string | null = null

async function getClientId(db: ReturnType<typeof getDatabase>): Promise<string> {
  if (_cachedClientId) return _cachedClientId

  const fp = navigator.userAgent + navigator.language + screen.width + screen.height
  const hash = fp.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  const fingerprintId = 'fp_' + Math.abs(hash).toString(36)

  const snap = await get(ref(db, `${DB_USER_SETTINGS_PATH}/${fingerprintId}/clientId`))
  if (snap.exists()) {
    _cachedClientId = snap.val()
  } else {
    _cachedClientId = 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
    await set(ref(db, `${DB_USER_SETTINGS_PATH}/${fingerprintId}/clientId`), _cachedClientId)
  }
  return _cachedClientId!
}

export function useFirebaseSync() {
  const applyRemoteData = usePlanningStore(s => s.applyRemoteData)
  const getSnapshot     = usePlanningStore(s => s.getSnapshot)
  const setSyncStatus   = useViewStore(s => s.setSyncStatus)

  const dbRef       = useRef<ReturnType<typeof getDatabase> | null>(null)
  const clientIdRef = useRef<string | null>(null)
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstLoad   = useRef(true)

  // Init Firebase once
  useEffect(() => {
    const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG)
    const db  = getDatabase(app)
    dbRef.current = db

    setSyncStatus('connecting')

    getClientId(db).then(id => {
      clientIdRef.current = id

      const planningRef = ref(db, DB_PLANNING_PATH)

      onValue(planningRef, snapshot => {
        const data = snapshot.val() as PlanningDocument | null
        if (!data) { setSyncStatus('connected'); return }

        // Ignore our own writes
        if (!firstLoad.current && data._clientId === clientIdRef.current) return

        firstLoad.current = false
        applyRemoteData(data)
        setSyncStatus('synced')
      }, err => {
        console.error('[Firebase] listener error:', err)
        setSyncStatus('error')
      })

      setSyncStatus('connected')
    }).catch(err => {
      console.error('[Firebase] init error:', err)
      setSyncStatus('error')
    })

    return () => {
      if (dbRef.current) {
        off(ref(dbRef.current, DB_PLANNING_PATH))
      }
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to planning store changes and debounce-save
  useEffect(() => {
    const unsub = usePlanningStore.subscribe(() => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        if (!dbRef.current || !clientIdRef.current) return
        const doc: PlanningDocument = {
          ...getSnapshot(),
          _clientId: clientIdRef.current,
          _savedAt: Date.now(),
        }
        set(ref(dbRef.current, DB_PLANNING_PATH), doc).catch(err => {
          console.error('[Firebase] save error:', err)
          setSyncStatus('error')
        })
        setSyncStatus('synced')
      }, 400)
    })
    return () => { unsub(); if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
}
