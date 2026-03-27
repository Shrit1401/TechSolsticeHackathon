'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import { LayoutGrid, LayoutPanelTop } from 'lucide-react'
import { widgetGridClass, type WidgetId, type WidgetSize } from '@/lib/constants'
import { useGridLayout } from '@/hooks/useGridLayout'
import { BaseWidget } from '@/components/dashboard/widgets/BaseWidget'
import { WidgetSizeProvider } from '@/components/dashboard/WidgetSizeContext'
import { widgetMeta, WidgetBody } from '@/components/dashboard/widgets/widgetContents'
import { cn } from '@/lib/utils'

function LocalTimeClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const formatted = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  return (
    <div className="flex flex-col items-center gap-2 px-2 text-center">
      <span className="text-[11px] font-normal uppercase tracking-[0.06em] text-[var(--text-tertiary)] [font-family:var(--font-hero-display)] sm:text-xs">
        Local time
      </span>
      <time
        dateTime={now.toISOString()}
        className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)] [font-family:var(--font-ui)] sm:text-5xl md:text-6xl lg:text-7xl"
      >
        {formatted}
      </time>
    </div>
  )
}

export function MetricsGrid({
  editMode,
  expandedId,
  compactMode,
  onCompactModeChange,
  onExpandedChange,
  onCustomize,
  onDone,
}: {
  editMode: boolean
  expandedId: WidgetId | null
  compactMode: boolean
  onCompactModeChange: (value: boolean) => void
  onExpandedChange: (id: WidgetId | null) => void
  onCustomize: () => void
  onDone: () => void
}) {
  const { order, hydrated, sizes, setOrder, toggleSize } = useGridLayout()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = order.indexOf(active.id as WidgetId)
      const newIndex = order.indexOf(over.id as WidgetId)
      if (oldIndex < 0 || newIndex < 0) return
      setOrder(arrayMove(order, oldIndex, newIndex))
    },
    [order, setOrder]
  )

  if (!hydrated) {
    return <div className="min-h-[400px]" aria-hidden />
  }

  return (
    <div className="relative -mt-4 flex flex-col gap-4 md:-mt-8">
      <div className="relative flex w-full flex-col items-center gap-8 pt-0 sm:min-h-[min(20vh,200px)] sm:justify-center sm:gap-0 sm:py-4">
        {editMode && (
          <p className="max-w-xl text-center text-[13px] font-normal tracking-[0.06em] text-[var(--text-tertiary)] [font-family:var(--font-hero-display)] sm:absolute sm:left-0 sm:top-1/2 sm:max-w-[min(42%,380px)] sm:-translate-y-1/2 sm:text-left sm:text-[0.875rem]">
            Drag widgets to reorder · ⧉ cycles size: 1×1 → 2×1 → 3×1 → 2×2
          </p>
        )}
        <div className="flex w-full justify-center">
          <LocalTimeClock />
        </div>
        <div className="grid w-full grid-cols-1 justify-items-stretch gap-2 sm:absolute sm:right-0 sm:top-1/2 sm:w-auto sm:-translate-y-1/2">
          <button
            type="button"
            onClick={() => onCompactModeChange(!compactMode)}
            className={cn(
              'inline-flex min-w-0 items-center justify-center gap-2 rounded-full border px-5 py-3 text-[0.9375rem] font-medium shadow-[0_4px_24px_rgba(0,0,0,0.45)] transition-colors [font-family:var(--font-ui)]',
              compactMode
                ? 'border-white/[0.22] bg-white/[0.08] text-white hover:border-white/[0.28] hover:bg-white/[0.12]'
                : 'border-white/[0.1] bg-black text-[#e5e7eb] hover:border-white/[0.18] hover:bg-black'
            )}
            aria-pressed={compactMode}
          >
            <LayoutPanelTop className="size-[1.125rem] opacity-90" strokeWidth={1.75} aria-hidden />
            Compact mode
          </button>
          <button
            type="button"
            onClick={editMode ? onDone : onCustomize}
            className={cn(
              'inline-flex min-w-0 items-center justify-center gap-2 rounded-full border border-white/[0.1] bg-black px-5 py-3 text-[0.9375rem] font-medium text-[#e5e7eb] shadow-[0_4px_24px_rgba(0,0,0,0.45)] transition-colors',
              'hover:border-white/[0.18] hover:bg-black [font-family:var(--font-ui)]'
            )}
          >
            <LayoutGrid className="size-[1.125rem] opacity-90" strokeWidth={1.75} aria-hidden />
            {editMode ? 'Done' : 'Customize'}
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={rectSortingStrategy}>
            <div
              className={cn(
                'grid grid-cols-1 auto-rows-[280px] md:items-stretch',
                compactMode
                  ? 'gap-3 md:grid-cols-2 lg:grid-cols-5 lg:gap-3 lg:auto-rows-[minmax(240px,280px)]'
                  : 'gap-4 md:grid-cols-3'
              )}
            >
              {order.map(id => (
                <SortableWidget
                  key={id}
                  id={id}
                  editMode={editMode}
                  expandedId={expandedId}
                  compactMode={compactMode}
                  onExpand={() => onExpandedChange(id)}
                  sizes={sizes}
                  onToggleSize={() => toggleSize(id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
    </div>
  )
}

function SortableWidget({
  id,
  editMode,
  expandedId,
  compactMode,
  onExpand,
  sizes,
  onToggleSize,
}: {
  id: WidgetId
  editMode: boolean
  expandedId: WidgetId | null
  compactMode: boolean
  onExpand: () => void
  sizes: Record<WidgetId, WidgetSize>
  onToggleSize: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editMode || expandedId === id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const meta = widgetMeta(id)
  const size = sizes[id]
  /** In compact mode all tiles share one cell and 1×1 chart density; stored sizes apply again when compact is off. */
  const layoutSize: WidgetSize = compactMode ? '1x1' : size
  const gridSpan = widgetGridClass(layoutSize, compactMode)

  return (
    <div ref={setNodeRef} style={style} className={cn(gridSpan, 'min-h-0 h-full w-full')}>
      {expandedId === id ? (
        <div
          className="min-h-[min(60vh,420px)] w-full rounded-[20px] border border-dashed border-white/25 bg-black/20"
          aria-hidden
        />
      ) : (
        <WidgetSizeProvider size={layoutSize}>
          <BaseWidget
            id={id}
            title={meta.title}
            subtitle={meta.subtitle}
            size={size}
            editMode={editMode}
            isDragging={isDragging}
            colSpanClass=""
            dragAttributes={attributes}
            dragListeners={editMode ? listeners : undefined}
            onExpand={onExpand}
            onResize={editMode ? onToggleSize : undefined}
          >
            <WidgetBody id={id} />
          </BaseWidget>
        </WidgetSizeProvider>
      )}
    </div>
  )
}
