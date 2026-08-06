import { FM, SM, VM, type JbValue } from './types'

export function asString(v: unknown): JbValue {
  if (v === null || v === undefined) return ''
  return String(v)
}

export function asNumber(v: unknown): number {
  const s = asString(v).trim()
  if (s === '') return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

export function isTruthy(v: unknown): boolean {
  const s = asString(v)
  if (s === '' || s === '0') return false
  return true
}

export function extract(value: JbValue, f: number, v?: number, s?: number): JbValue {
  // 1-based indices in jBC
  const fields = value.split(FM)
  const field = fields[f - 1] ?? ''
  if (v === undefined) return field
  const values = field.split(VM)
  const val = values[v - 1] ?? ''
  if (s === undefined) return val
  const sub = val.split(SM)
  return sub[s - 1] ?? ''
}

export function replaceExtract(
  value: JbValue,
  replacement: JbValue,
  f: number,
  v?: number,
  s?: number,
): JbValue {
  const fields = value === '' ? [] : value.split(FM)
  while (fields.length < f) fields.push('')
  if (v === undefined) {
    fields[f - 1] = replacement
    return fields.join(FM)
  }
  const values = (fields[f - 1] ?? '').split(VM)
  while (values.length < v) values.push('')
  if (s === undefined) {
    values[v - 1] = replacement
    fields[f - 1] = values.join(VM)
    return fields.join(FM)
  }
  const subs = (values[v - 1] ?? '').split(SM)
  while (subs.length < s) subs.push('')
  subs[s - 1] = replacement
  values[v - 1] = subs.join(SM)
  fields[f - 1] = values.join(VM)
  return fields.join(FM)
}

export function substring(value: JbValue, start: number, length?: number): JbValue {
  // jBC substring is 1-based
  const from = Math.max(0, start - 1)
  if (length === undefined) return value.slice(from)
  return value.slice(from, from + Math.max(0, length))
}

export function compare(a: unknown, b: unknown, op: string): boolean {
  const na = asString(a)
  const nb = asString(b)
  const bothNum = na !== '' && nb !== '' && !isNaN(Number(na)) && !isNaN(Number(nb))
  const left = bothNum ? Number(na) : na
  const right = bothNum ? Number(nb) : nb
  switch (op) {
    case '=':
    case ':=':
      return left == right
    case '<>':
    case '#':
      return left != right
    case '>':
      return left > right
    case '<':
      return left < right
    case '>=':
      return left >= right
    case '<=':
      return left <= right
    default:
      return false
  }
}

export { FM, VM, SM }
