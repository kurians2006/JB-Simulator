import { asNumber, asString, formatNumber, FM, SM, VM } from './value'
import type { JbValue } from './types'

type BuiltinFn = (args: JbValue[]) => JbValue

function pad(s: string, n: number, left: boolean, ch = ' '): string {
  if (s.length >= n) return s
  const fill = ch.repeat(n - s.length)
  return left ? fill + s : s + fill
}

export const builtins: Record<string, BuiltinFn> = {
  LEN: (a) => String(asString(a[0]).length),
  NUM: (a) => {
    const s = asString(a[0]).trim()
    return s !== '' && !isNaN(Number(s)) ? '1' : '0'
  },
  INT: (a) => String(Math.trunc(asNumber(a[0]))),
  ABS: (a) => String(Math.abs(asNumber(a[0]))),
  MOD: (a) => String(asNumber(a[0]) % asNumber(a[1])),
  REM: (a) => String(asNumber(a[0]) % asNumber(a[1])),
  NOT: (a) => (asString(a[0]) === '' || asString(a[0]) === '0' ? '1' : '0'),
  CHAR: (a) => String.fromCharCode(asNumber(a[0])),
  SEQ: (a) => String(asString(a[0]).charCodeAt(0) || 0),
  UPCASE: (a) => asString(a[0]).toUpperCase(),
  DOWNCASE: (a) => asString(a[0]).toLowerCase(),
  LOWCASE: (a) => asString(a[0]).toLowerCase(),
  TRIM: (a) => asString(a[0]).trim(),
  TRIMF: (a) => asString(a[0]).replace(/^\s+/, ''),
  TRIMB: (a) => asString(a[0]).replace(/\s+$/, ''),
  LEFT: (a) => asString(a[0]).slice(0, Math.max(0, asNumber(a[1]))),
  RIGHT: (a) => {
    const s = asString(a[0])
    const n = Math.max(0, asNumber(a[1]))
    return s.slice(Math.max(0, s.length - n))
  },
  NEG: (a) => formatNumber(-asNumber(a[0])),
  SWAP: (a) => asString(a[0]).split(asString(a[1])).join(asString(a[2])),
  FIELD: (a) => {
    const str = asString(a[0])
    const delim = asString(a[1]) || FM
    const n = asNumber(a[2])
    return str.split(delim)[n - 1] ?? ''
  },
  COUNT: (a) => {
    const str = asString(a[0])
    const sub = asString(a[1])
    if (!sub) return '0'
    return String(str.split(sub).length - 1)
  },
  DCOUNT: (a) => {
    const str = asString(a[0])
    const delim = asString(a[1]) || FM
    if (str === '') return '0'
    return String(str.split(delim).length)
  },
  INDEX: (a) => {
    const str = asString(a[0])
    const sub = asString(a[1])
    const occ = asNumber(a[2] ?? '1')
    let from = 0
    for (let i = 0; i < occ; i++) {
      const idx = str.indexOf(sub, from)
      if (idx < 0) return '0'
      if (i === occ - 1) return String(idx + 1)
      from = idx + sub.length
    }
    return '0'
  },
  DATE: () => {
    // Pick-style internal date approx: days since 31 Dec 1967
    const epoch = Date.UTC(1967, 11, 31)
    const now = Date.now()
    return String(Math.floor((now - epoch) / 86400000))
  },
  TIME: () => {
    const d = new Date()
    return String(d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds())
  },
  TIMEDATE: () => new Date().toString(),
  SPACE: (a) => ' '.repeat(Math.max(0, asNumber(a[0]))),
  STR: (a) => asString(a[0]).repeat(Math.max(0, asNumber(a[1]))),
  FMT: (a) => {
    // very small subset: nR / nL
    const val = asString(a[0])
    const fmt = asString(a[1]).toUpperCase()
    const m = /^(\d+)([RL])$/.exec(fmt)
    if (m) return pad(val, Number(m[1]), m[2] === 'R')
    return val
  },
  OCONV: (a) => {
    const val = asString(a[0])
    const code = asString(a[1]).toUpperCase()
    if (code === 'D4/' || code === 'D2/' || code.startsWith('D')) {
      const days = asNumber(val)
      const d = new Date(Date.UTC(1967, 11, 31) + days * 86400000)
      const dd = String(d.getUTCDate()).padStart(2, '0')
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
      const yyyy = d.getUTCFullYear()
      return `${dd}/${mm}/${yyyy}`
    }
    if (code.startsWith('MTS') || code === 'MTS') {
      const secs = asNumber(val)
      const h = Math.floor(secs / 3600)
      const m = Math.floor((secs % 3600) / 60)
      const s = secs % 60
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }
    return val
  },
  ICONV: (a) => {
    const val = asString(a[0])
    const code = asString(a[1]).toUpperCase()
    if (code.startsWith('D')) {
      const parts = val.split(/[\/\-.]/)
      if (parts.length >= 3) {
        const d = Number(parts[0])
        const m = Number(parts[1]) - 1
        const y = Number(parts[2].length === 2 ? '20' + parts[2] : parts[2])
        const epoch = Date.UTC(1967, 11, 31)
        const t = Date.UTC(y, m, d)
        return String(Math.floor((t - epoch) / 86400000))
      }
    }
    return val
  },
  CHANGE: (a) => asString(a[0]).split(asString(a[1])).join(asString(a[2])),
  CONVERT: (a) => {
    // CONVERT(from, to, string) character by character
    const from = asString(a[0])
    const to = asString(a[1])
    let str = asString(a[2])
    for (let i = 0; i < from.length; i++) {
      const f = from[i]!
      const t = to[i] ?? ''
      str = str.split(f).join(t)
    }
    return str
  },
  ALPHA: (a) => (/^[A-Za-z]+$/.test(asString(a[0])) ? '1' : '0'),
  SYSTEM: (a) => {
    const n = asNumber(a[0])
    if (n === 18) return 'JB-SIMULATOR'
    if (n === 19) return '1'
    return ''
  },
  ASSIGNED: (a) => (a[0] !== undefined && a[0] !== null ? '1' : '0'),
  SQRT: (a) => formatNumber(Math.sqrt(asNumber(a[0]))),
  RND: (a) => String(Math.floor(Math.random() * asNumber(a[0]))),
}

/** Predefined equate-like constants available at runtime */
export const CONSTANTS: Record<string, JbValue> = {
  FM: FM,
  VM: VM,
  SM: SM,
  AM: FM,
  IM: String.fromCharCode(255),
  TRUE: '1',
  FALSE: '0',
}
