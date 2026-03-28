/** Widget grid identifiers — stable for localStorage + dnd-kit */
export const WIDGET_IDS = [
  "request-rate",
  "error-rate",
  "latency",
  "throughput",
  "cpu",
  "memory",
  "connections",
  "anomaly",
  "service-map",
  "incident-timeline",
  "queue-depth",
  "saturation",
  "disk-io",
  "network-in",
  "gc-pause",
  "cache-hit",
  "thread-pool",
  "db-connections",
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

/** Grid modes: 1×1 · 2×1 · 3×1 · 2×2 */
export type WidgetSize = "1x1" | "2x1" | "3x1" | "2x2";

export const WIDGET_SIZE_CYCLE: readonly WidgetSize[] = [
  "1x1",
  "2x1",
  "3x1",
  "2x2",
] as const;

export function isWidgetSize(s: string): s is WidgetSize {
  return (WIDGET_SIZE_CYCLE as readonly string[]).includes(s);
}

export function nextWidgetSize(current: WidgetSize): WidgetSize {
  const i = WIDGET_SIZE_CYCLE.indexOf(current);
  const next = (i >= 0 ? i + 1 : 0) % WIDGET_SIZE_CYCLE.length;
  return WIDGET_SIZE_CYCLE[next];
}

export function widgetGridClass(size: WidgetSize): string {
  switch (size) {
    case "1x1":
      return "col-span-1 row-span-1";
    case "2x1":
      return "col-span-1 row-span-1 md:col-span-2 md:row-span-1";
    case "3x1":
      return "col-span-1 row-span-1 md:col-span-3 md:row-span-1";
    case "2x2":
      return "col-span-1 row-span-2 md:col-span-2 md:row-span-2";
    default:
      return "col-span-1 row-span-1";
  }
}

/** Widgets shown in the hero section — excluded from the draggable grid */
export const HERO_WIDGET_IDS: readonly WidgetId[] = ['request-rate', 'latency', 'error-rate'] as const

/** Default order — latency and throughput are in the hero section, not the grid */
export const DEFAULT_WIDGET_ORDER: WidgetId[] = WIDGET_IDS.filter(
  id => id !== 'latency' && id !== 'throughput'
)

export const DEFAULT_WIDGET_SIZES: Record<WidgetId, WidgetSize> = {
  "request-rate": "3x1",
  "error-rate": "2x1",
  latency: "2x1",
  throughput: "2x1",
  cpu: "1x1",
  memory: "1x1",
  connections: "2x1",
  anomaly: "1x1",
  "service-map": "2x1",
  "incident-timeline": "2x1",
  "queue-depth": "1x1",
  saturation: "1x1",
  "disk-io": "1x1",
  "network-in": "1x1",
  "gc-pause": "1x1",
  "cache-hit": "1x1",
  "thread-pool": "1x1",
  "db-connections": "1x1",
};

export const LAYOUT_STORAGE_KEY = "aiops-widget-layout-v4";

export type StoredLayout = {
  v: 1;
  order: WidgetId[];
  sizes: Record<WidgetId, WidgetSize>;
};
