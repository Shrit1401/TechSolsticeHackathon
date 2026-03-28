"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  defaultDropAnimation,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import {
  widgetGridClass,
  type WidgetId,
  type WidgetSize,
} from "@/lib/constants";
import { BaseWidget } from "@/components/dashboard/widgets/BaseWidget";
import { WidgetSizeProvider } from "@/components/dashboard/WidgetSizeContext";
import {
  widgetMeta,
  WidgetBody,
} from "@/components/dashboard/widgets/widgetContents";
import { cn } from "@/lib/utils";
import { MetricCardMotionContext } from "@/contexts/MetricCardMotionContext";
import { useWidgetCardStatus } from "@/hooks/useWidgetCardStatus";
import { AdaptiveStatusBar } from "@/components/dashboard/AdaptiveStatusBar";
import type { IssueRow } from "@/lib/priorityScore";

/** Smoother reflow than default 200ms ease — matches dashboard motion curves */
const SORTABLE_TRANSITION = {
  duration: 320,
  easing: "cubic-bezier(0.32, 0.72, 0, 1)",
} as const;

const DROP_ANIMATION = {
  ...defaultDropAnimation,
  duration: 280,
  easing: "cubic-bezier(0.32, 0.72, 0, 1)",
};

function TileDragPreview({
  id,
  compactMode,
  size,
}: {
  id: WidgetId;
  compactMode: boolean;
  size: WidgetSize;
}) {
  const meta = widgetMeta(id);
  const layoutSize: WidgetSize = compactMode ? "1x1" : size;
  const wide = layoutSize === "2x1" || layoutSize === "3x1";

  return (
    <div
      className={cn(
        "pointer-events-none rounded-[20px] border border-white/25 bg-black/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.85)] ring-2 ring-[var(--accent-cyan)]/20 backdrop-blur-sm [font-family:var(--font-ui)]",
        wide ? "w-[min(92vw,520px)]" : "w-[min(92vw,340px)]",
        layoutSize === "2x2" && "min-h-[260px]",
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
        {meta.title}
      </p>
      {meta.subtitle ? (
        <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">{meta.subtitle}</p>
      ) : null}
      <p className="mt-8 text-center text-[13px] text-white/30">Moving widget…</p>
    </div>
  );
}

export function MetricsGrid({
  order,
  setOrder,
  sizes,
  toggleSize,
  hydrated,
  editMode,
  expandedId,
  compactMode,
  onExpandedChange,
  adaptiveEngaged,
  adaptiveRestoring,
  adaptiveEnabled,
  showAdaptiveChrome,
  getTileAdaptiveStatus,
  adaptiveLayoutTransition,
  issues,
}: {
  order: WidgetId[];
  setOrder: (next: WidgetId[], options?: { persist?: boolean }) => void;
  sizes: Record<WidgetId, WidgetSize>;
  toggleSize: (id: WidgetId) => void;
  hydrated: boolean;
  editMode: boolean;
  expandedId: WidgetId | null;
  compactMode: boolean;
  onExpandedChange: (id: WidgetId | null) => void;
  adaptiveEngaged: boolean;
  adaptiveRestoring: boolean;
  adaptiveEnabled: boolean;
  showAdaptiveChrome: boolean;
  getTileAdaptiveStatus: (id: WidgetId) => "healthy" | "watch" | "critical";
  adaptiveLayoutTransition: { duration: number; ease: number[] };
  issues: IssueRow[];
}) {
  const [activeDragId, setActiveDragId] = useState<WidgetId | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as WidgetId);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = order.indexOf(active.id as WidgetId);
      const newIndex = order.indexOf(over.id as WidgetId);
      if (oldIndex < 0 || newIndex < 0) return;
      setOrder(arrayMove(order, oldIndex, newIndex));
    },
    [order, setOrder],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
  }, []);

  if (!hydrated) {
    return <div className="min-h-[400px]" aria-hidden />;
  }

  return (
    <div className="relative flex flex-col gap-4">
      <AdaptiveStatusBar visible={showAdaptiveChrome} issues={issues} />

      {editMode && !adaptiveEngaged && (
        <p className="max-w-xl text-[13px] font-normal tracking-[0.06em] text-[var(--text-tertiary)] [font-family:var(--font-hero-display)] sm:text-[0.875rem]">
          Drag widgets to reorder · ⧉ cycles size: 1×1 → 2×1 → 3×1 → 2×2
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div
            className={cn(
              "grid grid-cols-1 auto-rows-[280px] md:items-stretch",
              showAdaptiveChrome && "adaptive-engaged",
              compactMode
                ? "gap-3 md:grid-cols-2 lg:grid-cols-5 lg:gap-3 lg:auto-rows-[minmax(240px,280px)]"
                : "gap-4 md:grid-cols-3",
            )}
          >
            {order.map((id, index) => (
              <SortableWidget
                key={id}
                id={id}
                index={index}
                editMode={editMode}
                expandedId={expandedId}
                compactMode={compactMode}
                onExpand={() => onExpandedChange(id)}
                sizes={sizes}
                onToggleSize={() => toggleSize(id)}
                adaptiveEngaged={adaptiveEngaged}
                adaptiveRestoring={adaptiveRestoring}
                adaptiveEnabled={adaptiveEnabled}
                showAdaptiveChrome={showAdaptiveChrome}
                getTileAdaptiveStatus={getTileAdaptiveStatus}
                adaptiveLayoutTransition={adaptiveLayoutTransition}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay adjustScale={false} dropAnimation={DROP_ANIMATION} zIndex={100}>
          {activeDragId ? (
            <TileDragPreview id={activeDragId} compactMode={compactMode} size={sizes[activeDragId]} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function SortableWidget({
  id,
  index,
  editMode,
  expandedId,
  compactMode,
  onExpand,
  sizes,
  onToggleSize,
  adaptiveEngaged,
  adaptiveRestoring,
  adaptiveEnabled,
  showAdaptiveChrome,
  getTileAdaptiveStatus,
  adaptiveLayoutTransition,
}: {
  id: WidgetId;
  index: number;
  editMode: boolean;
  expandedId: WidgetId | null;
  compactMode: boolean;
  onExpand: () => void;
  sizes: Record<WidgetId, WidgetSize>;
  onToggleSize: () => void;
  adaptiveEngaged: boolean;
  adaptiveRestoring: boolean;
  adaptiveEnabled: boolean;
  showAdaptiveChrome: boolean;
  getTileAdaptiveStatus: (id: WidgetId) => "healthy" | "watch" | "critical";
  adaptiveLayoutTransition: { duration: number; ease: number[] };
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: !editMode || expandedId === id || adaptiveEngaged,
    transition: SORTABLE_TRANSITION,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const meta = widgetMeta(id);
  const size = sizes[id];
  /** In compact mode all tiles share one cell and 1×1 chart density; stored sizes apply again when compact is off. */
  const layoutSize: WidgetSize = compactMode ? "1x1" : size;
  const gridSpan = widgetGridClass(layoutSize, compactMode);
  const status = useWidgetCardStatus(id, { adaptiveEnabled });
  const countUpDelayMs = Math.round((0.15 + index * 0.08) * 1000) + 500;
  const layoutOn = adaptiveEngaged && !editMode && !adaptiveRestoring;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        gridSpan,
        "min-h-0 h-full w-full",
        editMode && "motion-safe:will-change-transform",
        isDragging && "z-40 opacity-[0.22]",
      )}
    >
      <motion.div
        className="h-full w-full"
        layout={layoutOn}
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          opacity: { duration: 0.5, delay: 0.15 + index * 0.08, ease: [0.16, 1, 0.3, 1] },
          y: { duration: 0.5, delay: 0.15 + index * 0.08, ease: [0.16, 1, 0.3, 1] },
          scale: { duration: 0.5, delay: 0.15 + index * 0.08, ease: [0.16, 1, 0.3, 1] },
          layout: {
            duration: adaptiveLayoutTransition.duration,
            ease: adaptiveLayoutTransition.ease as [number, number, number, number],
          },
        }}
      >
        {expandedId === id ? (
          <div
            className="min-h-[min(60vh,420px)] w-full rounded-[20px] border border-dashed border-white/25 bg-black/20"
            aria-hidden
          />
        ) : (
          <WidgetSizeProvider size={layoutSize}>
            <MetricCardMotionContext.Provider value={{ countUpDelayMs }}>
              <BaseWidget
                id={id}
                title={meta.title}
                subtitle={meta.subtitle}
                status={status}
                size={size}
                editMode={editMode}
                isDragging={isDragging}
                colSpanClass=""
                dragAttributes={attributes}
                dragListeners={editMode ? listeners : undefined}
                onExpand={onExpand}
                onResize={editMode ? onToggleSize : undefined}
                adaptiveTileStatus={showAdaptiveChrome ? getTileAdaptiveStatus(id) : null}
              >
                <WidgetBody id={id} />
              </BaseWidget>
            </MetricCardMotionContext.Provider>
          </WidgetSizeProvider>
        )}
      </motion.div>
    </div>
  );
}
