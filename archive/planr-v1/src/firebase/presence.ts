import { useEffect, useRef } from 'react'
import { getDatabase, ref, set, onValue, off } from 'firebase/database'
import { getApps } from 'firebase/app'
import { DB_PRESENCE_PATH } from './config'
import { useViewStore } from '@/store/viewStore'

const USER_COLORS = [
  '#6366f1','#22c55e','#f59e0b','#ef4444',
  '#8b5cf6','#ec4899','#06b6d4',
]

function getMyColor(clientId: string): string {
  let hash = 0
  for (const c of clientId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return USER_COLORS[hash % USER_COLORS.length]
}

export function usePresence(clientId: string | null, userName: string) {
  const setUsersOnline = useViewStore(s => s.setUsersOnline)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!clientId) return
    const db = getDatabase(getApps()[0])
    const myRef = ref(db, `${DB_PRESENCE_PATH}/${clientId}`)

    const ping = () => {
      set(myRef, {
        name: userName,
        color: getMyColor(clientId),
        clientId,
        lastSeen: Date.now(),
      }).catch(() => {})
    }

    ping()
    intervalRef.current = setInterval(ping, 30_000)

    const presRef = ref(db, DB_PRESENCE_PATH)
    onValue(presRef, snap => {
      const data = snap.val() as Record<string, { name: string; color: string; lastSeen: number }> | null
      if (!data) { setUsersOnline({}); return }
      // Keep only users active within the last 2 minutes
      const active: typeof data = {}
      const now = Date.now()
      for (const [id, u] of Object.entries(data)) {
        if (now - u.lastSeen < 120_000) active[id] = u
      }
      setUsersOnline(active)
    })

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      off(presRef)
    }
  }, [clientId, userName, setUsersOnline])
}
