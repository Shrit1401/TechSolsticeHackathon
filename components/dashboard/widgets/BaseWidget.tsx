"use client";

import { type DraggableSyntheticListeners } from "@dnd-kit/core";
import type { DraggableAttributes } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { GripVertical, Maximize2 } from "lucide-react";
import type { WidgetId, WidgetSize } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { StatusBadge, type Status } from "@/components/ui/StatusBadge";

type BaseWidgetProps = {
  id: WidgetId;
  title: string;
  subtitle?: string;
  status: Status;
  size: WidgetSize;
  editMode: boolean;
  isDragging: boolean;
  colSpanClass: string;
  dragAttributes: DraggableAttributes;
  dragListeners: DraggableSyntheticListeners | undefined;
  onExpand: () => void;
  onResize?: () => void;
  children: React.ReactNode;
};

export const BaseWidget = ({
  id,
  title,
  subtitle,
  size,
  editMode,
  isDragging,
  colSpanClass,
  dragAttributes,
  dragListeners,
  onExpand,
  onResize,
  status,
  children,
}: BaseWidgetProps) => {
  const layoutId = `widget-card-${id}`;

  return (
    <motion.article
      data-widget-id={id}
      layoutId={layoutId}
      className={cn(
        "metric-card group relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[22px] border border-white/[0.14] bg-gradient-to-b from-black to-black/95 p-6 shadow-[0_4px_32px_rgba(0,0,0,0.5)] transition-[border-color,box-shadow,opacity,transform] duration-200 [font-family:var(--font-ui)]",
        "hover:border-white/28 hover:shadow-[0_8px_40px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.05)]",
        colSpanClass,
        editMode && "ring-1 ring-white/25",
        isDragging && "z-50 scale-[1.04] shadow-[0_16px_48px_rgba(0,0,0,0.5)]",
      )}
      initial={false}
      transition={{ layout: { duration: 0.35, ease: [0.32, 0.72, 0, 1] } }}
    >
      {editMode && (
        <button
          type="button"
          data-drag-handle
          className="absolute left-1/2 top-2 z-10 -translate-x-1/2 cursor-grab rounded-md p-1 text-[var(--text-tertiary)] hover:bg-white/5 hover:text-[var(--text-secondary)] active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...dragAttributes}
          {...dragListeners}
        >
          <GripVertical className="size-4" strokeWidth={1.75} />
        </button>
      )}

      <div className="mb-4 shrink-0 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B7A8D]">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-1 text-[13px] text-[#4A5568]">
              {subtitle}
            </p>
          )}
        </div>
        {!editMode && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
            className="rounded-lg p-1.5 text-[var(--text-tertiary)] opacity-0 transition-opacity hover:bg-white/5 hover:text-[var(--accent-cyan)] group-hover:opacity-100"
            aria-label={`Expand ${title}`}
          >
            <Maximize2 className="size-4" strokeWidth={1.75} />
          </button>
        )}
        {editMode && onResize && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onResize();
            }}
            className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-white/5"
            aria-label={`Cycle widget size (current ${size})`}
          >
            <span className="text-xs" aria-hidden>
              ⧉
            </span>
          </button>
        )}
      </div>

      <div className="mb-3 shrink-0">
        <StatusBadge status={status} />
      </div>

      <button
        type="button"
        className="flex min-h-0 flex-1 flex-col overflow-hidden text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cyan)]/40"
        onClick={() => {
          if (!editMode) onExpand();
        }}
        disabled={editMode}
      >
        {children}
      </button>
    </motion.article>
  );
};
