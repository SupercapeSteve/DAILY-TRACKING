import type { Units } from './types'

// Weights and heights are always STORED in metric (kg, cm) and only converted
// for display. That way switching units never rewrites her history.

export const kgToLb = (kg: number) => kg * 2.2046226218
export const lbToKg = (lb: number) => lb / 2.2046226218
export const cmToIn = (cm: number) => cm / 2.54
export const inToCm = (i: number) => i * 2.54

export function formatWeight(kg: number | null | undefined, units: Units, withUnit = true): string {
  if (kg == null) return '--'
  if (units === 'metric') return `${round1(kg)}${withUnit ? ' kg' : ''}`
  return `${round1(kgToLb(kg))}${withUnit ? ' lb' : ''}`
}

export function formatWeightDelta(kg: number, units: Units): string {
  const v = units === 'metric' ? kg : kgToLb(kg)
  const s = round1(Math.abs(v))
  if (Math.abs(v) < 0.05) return 'no change'
  return `${v > 0 ? '+' : '-'}${s} ${units === 'metric' ? 'kg' : 'lb'}`
}

export function formatHeight(cm: number | null | undefined, units: Units): string {
  if (cm == null) return '--'
  if (units === 'metric') return `${Math.round(cm)} cm`
  const totalIn = Math.round(cmToIn(cm))
  return `${Math.floor(totalIn / 12)}' ${totalIn % 12}"`
}

/** Splits stored cm into feet + inches for the two-field imperial input. */
export function cmToFtIn(cm: number | null): { ft: number | null; inch: number | null } {
  if (cm == null) return { ft: null, inch: null }
  const totalIn = Math.round(cmToIn(cm))
  return { ft: Math.floor(totalIn / 12), inch: totalIn % 12 }
}

export function ftInToCm(ft: number | null, inch: number | null): number | null {
  if (ft == null && inch == null) return null
  return round1(inToCm((ft ?? 0) * 12 + (inch ?? 0)))
}

/** Turns what she typed in her own units into the kg we store. */
export function weightInputToKg(value: number | null, units: Units): number | null {
  if (value == null || Number.isNaN(value)) return null
  return round1(units === 'metric' ? value : lbToKg(value))
}

/** Turns stored kg into the number to show in the input box. */
export function kgToWeightInput(kg: number | null, units: Units): number | null {
  if (kg == null) return null
  return round1(units === 'metric' ? kg : kgToLb(kg))
}

export const weightUnitLabel = (units: Units) => (units === 'metric' ? 'kg' : 'lb')

export function ageFrom(birthdate: string | null | undefined): number | null {
  if (!birthdate) return null
  const [y, m, d] = birthdate.split('-').map(Number)
  if (!y) return null
  const today = new Date()
  let age = today.getFullYear() - y
  const hadBirthday =
    today.getMonth() + 1 > (m ?? 1) ||
    (today.getMonth() + 1 === (m ?? 1) && today.getDate() >= (d ?? 1))
  if (!hadBirthday) age--
  return age >= 0 && age < 130 ? age : null
}

/** BMI, only when we have both numbers. Shown as context, never as a verdict. */
export function bmi(kg: number | null, cm: number | null): number | null {
  if (!kg || !cm) return null
  const m = cm / 100
  return round1(kg / (m * m))
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function formatDuration(mins: number | null | undefined): string {
  if (mins == null || mins <= 0) return '--'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}
