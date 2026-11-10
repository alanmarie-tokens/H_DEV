import { useMemo, RefObject } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { usePlanningStore } from '@/store/planningStore'
import type { ViewColumn, MonthGroup, ZoomLevel, Row, Group } from '@/types/planning'
import { GanttRow } from './GanttRow'
import { GroupHeader } from '@/components/sidebar/GroupHeader'
import styles from './GanttBody.module.css'

interface Props {
  zoom: ZoomLevel
  viewColumns: ViewColumn[]
  monthGroups: MonthGroup[]
  colCount: number
  labelW: number
  recapW: number
  scrollRef: RefObject<HTMLDivElement>
}

type FlatItem =
  | { type: 'group'; group: Group }
  | { type: 'row'; row: Row }
  | { type: 'empty' }

export function GanttBody({ zoom, viewColumns, monthGroups, colCount, labelW, recapW, scrollRef }: Props) {
  const rows   = usePlanningStore(s => s.rows)
  const groups = usePlanningStore(s => s.groups)

  // Build flat list: groups with their rows
  const flatItems = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = []

    // Groups and their rows
    for (const group of groups) {
      items.push({ type: 'group', group })
      if (!group.collapsed) {
        const groupRows = rows.filter(r => r.groupId === group.id)
        for (const row of groupRows) {
          items.push({ type: 'row', row })
        }
      }
    }

    // Ungrouped rows
    const ungrouped = rows.filter(r => !r.groupId)
    for (const row of ungrouped) {
      items.push({ type: 'row', row })
    }

    if (items.length === 0) items.push({ type: 'empty' })
    return items
  }, [rows, groups])

  const rowVirtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => flatItems[i].type === 'group' ? 44 : 48,
    overscan: 8,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalHeight  = rowVirtualizer.getTotalSize()

  return (
    <div className={styles.body} style={{ height: totalHeight, position: 'relative' }}>
      {virtualItems.map(vi => {
        const item = flatItems[vi.index]
        return (
          <div
            key={vi.key}
            style={{
              position: 'absolute',
              top: vi.start,
              left: 0,
              right: 0,
              height: vi.size,
            }}
          >
            {item.type === 'group' && (
              <GroupHeader
                group={item.group}
                labelW={labelW}
                recapW={recapW}
                colCount={colCount}
              />
            )}
            {item.type === 'row' && (
              <GanttRow
                row={item.row}
                zoom={zoom}
                viewColumns={viewColumns}
                monthGroups={monthGroups}
                colCount={colCount}
                labelW={labelW}
                recapW={recapW}
                scrollRef={scrollRef}
              />
            )}
            {item.type === 'empty' && (
              <div className={styles.empty}>
                Cliquez sur <strong>+ Groupe</strong> ou <strong>+ Ligne</strong> pour commencer
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
