'use client'

import { Network, User, CreditCard, ShieldCheck, Activity } from 'lucide-react'
import { useDashboardStore } from '@/store/dashboardStore'
import { formatLatency } from '@/lib/utils'
import type { Service, ServiceStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const iconMap: Record<string, typeof Network> = {
  Network,
  User,
  CreditCard,
  ShieldCheck,
}

const statusLabel: Record<ServiceStatus, { label: string; className: string }> = {
  healthy: { label: 'Healthy', className: 'text-emerald-400/95' },
  degraded: { label: 'Degraded', className: 'text-amber-400/90' },
  down: { label: 'Down', className: 'text-red-400/90' },
}

function ServiceCard({ service }: { service: Service }) {
  const Icon = iconMap[service.icon] ?? Activity
  const badge = statusLabel[service.status]
  const isDown = service.status === 'down'
  const isDegraded = service.status === 'degraded'

  return (
    <div
      className={cn(
        'glass-l2 glass-l2-interactive p-6 border border-[#1f2937]',
        isDown && 'border-red-500/30',
        isDegraded && 'border-amber-500/25'
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <Icon
            className={cn(
              'w-4 h-4 shrink-0 text-[#9ca3af]',
              isDown && 'text-red-400/90',
              isDegraded && 'text-amber-400/90'
            )}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-white truncate">{service.displayName}</p>
            <p className="text-[11px] text-[#4b5563] font-mono truncate">{service.name}</p>
          </div>
        </div>
        <span className={cn('text-[11px] font-semibold shrink-0', badge.className)}>{badge.label}</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <span className="section-label !text-[0.6rem]">Latency</span>
          <p
            className={cn(
              'text-sm font-mono tabular-nums mt-2 text-white',
              isDown && 'text-red-400',
              isDegraded && 'text-amber-400'
            )}
          >
            {formatLatency(service.latency)}
          </p>
        </div>
        <div>
          <span className="section-label !text-[0.6rem]">Requests</span>
          <p className="text-sm font-mono tabular-nums mt-2 text-white">
            {(service.requestCount / 1000).toFixed(1)}k
          </p>
        </div>
        <div>
          <span className="section-label !text-[0.6rem]">Err rate</span>
          <p
            className={cn(
              'text-sm font-mono tabular-nums mt-2',
              service.errorRate > 10 ? 'text-red-400' : service.errorRate > 3 ? 'text-amber-400' : 'text-[#9ca3af]'
            )}
          >
            {service.errorRate.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="mt-5 h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500 ease-out',
            isDown ? 'bg-red-500/70' : isDegraded ? 'bg-amber-500/70' : 'bg-emerald-500/60'
          )}
          style={{ width: isDown ? '15%' : isDegraded ? '55%' : `${Math.max(8, 100 - service.errorRate * 2)}%` }}
        />
      </div>
    </div>
  )
}

export function ServicesPanel() {
  const services = useDashboardStore(s => s.services)

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-8">
        <h2 className="section-label">Services</h2>
        <span className="text-[11px] font-mono text-[#4b5563] tabular-nums">{services.length}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {services.map(service => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>
    </section>
  )
}
