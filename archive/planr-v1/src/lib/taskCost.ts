import type { Task, Row } from '@/types/planning'
import { fromYMD, workingDays } from './dateUtils'

export function taskCost(task: Task): { days: number; cost: number; etp: number } {
  const start = fromYMD(task.start)
  const end = fromYMD(task.end)
  const days = workingDays(start, end)
  const etp = task.etp ?? 1
  const tjm = task.tjm ?? 0
  return { days, cost: days * etp * tjm, etp }
}

export function rowTotals(row: Row): { totalCost: number; totalDays: number; avgEtp: number } {
  let totalCost = 0
  let etpDays = 0
  let totalDays = 0
  for (const t of row.tasks) {
    const { days, cost, etp } = taskCost(t)
    totalCost += cost
    etpDays += days * etp
    totalDays += days
  }
  const avgEtp = totalDays > 0 ? etpDays / totalDays : 0
  return { totalCost, totalDays, avgEtp }
}

export function fmtCost(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M€'
  if (n >= 1_000) return Math.round(n / 1_000) + 'k€'
  return Math.round(n) + '€'
}

export function fmtEtp(n: number): string {
  return n.toFixed(2) + ' ETP'
}
