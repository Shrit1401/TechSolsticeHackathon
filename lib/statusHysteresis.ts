import type { CardStatus } from '@/lib/widgetCardStatus'

/** Value-based hysteresis: separate enter vs exit thresholds to reduce boundary flicker. */

export function hysteresisErrorRate(value: number, prev: CardStatus): CardStatus {
  if (prev === 'healthy') {
    if (value >= 6) return 'critical'
    if (value >= 2.5) return 'watch'
    return 'healthy'
  }
  if (prev === 'watch') {
    if (value >= 6) return 'critical'
    if (value < 1.8) return 'healthy'
    return 'watch'
  }
  if (value < 4.5) return 'watch'
  return 'critical'
}

export function hysteresisLatency(ms: number, prev: CardStatus): CardStatus {
  if (prev === 'healthy') {
    if (ms >= 330) return 'critical'
    if (ms >= 170) return 'watch'
    return 'healthy'
  }
  if (prev === 'watch') {
    if (ms >= 330) return 'critical'
    if (ms < 130) return 'healthy'
    return 'watch'
  }
  if (ms < 270) return 'watch'
  return 'critical'
}

export function hysteresisCpu(pct: number, prev: CardStatus): CardStatus {
  if (prev === 'healthy') {
    if (pct >= 88) return 'critical'
    if (pct >= 70) return 'watch'
    return 'healthy'
  }
  if (prev === 'watch') {
    if (pct >= 88) return 'critical'
    if (pct < 58) return 'healthy'
    return 'watch'
  }
  if (pct < 80) return 'watch'
  return 'critical'
}

export function hysteresisMemory(pct: number, prev: CardStatus): CardStatus {
  if (prev === 'healthy') {
    if (pct >= 88) return 'critical'
    if (pct >= 75) return 'watch'
    return 'healthy'
  }
  if (prev === 'watch') {
    if (pct >= 88) return 'critical'
    if (pct < 65) return 'healthy'
    return 'watch'
  }
  if (pct < 80) return 'watch'
  return 'critical'
}

/** Request rate: deviation from baseline (same shape as requestRateStatus). */
export function hysteresisRequestRateDeviation(d: number, prev: CardStatus): CardStatus {
  if (prev === 'healthy') {
    if (d > 0.45) return 'critical'
    if (d > 0.28) return 'watch'
    return 'healthy'
  }
  if (prev === 'watch') {
    if (d > 0.45) return 'critical'
    if (d < 0.16) return 'healthy'
    return 'watch'
  }
  if (d < 0.32) return 'watch'
  return 'critical'
}

export function hysteresisAnomalyScore(score: number, prev: CardStatus): CardStatus {
  if (prev === 'healthy') {
    if (score >= 0.72) return 'critical'
    if (score >= 0.35) return 'watch'
    return 'healthy'
  }
  if (prev === 'watch') {
    if (score >= 0.72) return 'critical'
    if (score < 0.22) return 'healthy'
    return 'watch'
  }
  if (score < 0.55) return 'watch'
  return 'critical'
}

export function hysteresisConnectionsRatio(ratio: number, prev: CardStatus): CardStatus {
  if (prev === 'healthy') {
    if (ratio >= 0.92) return 'critical'
    if (ratio >= 0.82) return 'watch'
    return 'healthy'
  }
  if (prev === 'watch') {
    if (ratio >= 0.92) return 'critical'
    if (ratio < 0.76) return 'healthy'
    return 'watch'
  }
  if (ratio < 0.86) return 'watch'
  return 'critical'
}
