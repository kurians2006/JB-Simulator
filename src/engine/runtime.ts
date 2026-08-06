import { builtins, CONSTANTS } from './builtins'
import {
  asNumber,
  asString,
  compare,
  extract,
  formatNumber,
  isTruthy,
  replaceExtract,
  substring,
} from './value'
import { globalVfs } from './vfs'
import type {
  CompiledUnit,
  CompileError,
  Expr,
  JbValue,
  LValue,
  RunResult,
  RuntimeHooks,
  Statement,
} from './types'

class RuntimeError extends Error {
  line: number
  code: string
  constructor(message: string, line: number, code = 'TAFJ-RT') {
    super(message)
    this.line = line
    this.code = code
  }
}

type Control =
  | { type: 'none' }
  | { type: 'return'; value?: JbValue }
  | { type: 'goto'; label: string }
  | { type: 'stop'; code: number }
  | { type: 'abort' }

export class Interpreter {
  private vars = new Map<string, JbValue>()
  private equates = new Map<string, JbValue>()
  private common = new Map<string, JbValue>()
  private gosubStack: Array<{ stmts: Statement[]; index: number }> = []
  private labelIndex = new Map<string, { stmts: Statement[]; index: number }>()
  private stepCount = 0
  private maxSteps = 100_000

  private unit: CompiledUnit
  private hooks: RuntimeHooks
  private inputQueue: string[]

  constructor(unit: CompiledUnit, hooks: RuntimeHooks, inputQueue: string[] = []) {
    this.unit = unit
    this.hooks = hooks
    this.inputQueue = inputQueue
    for (const [k, v] of Object.entries(CONSTANTS)) {
      this.equates.set(k, v)
    }
    // T24-ish commons often used in training
    this.common.set('ID.NEW', '')
    this.common.set('ID.OLD', '')
    this.common.set('ETEXT', '')
    this.common.set('MESSAGE', '')
    this.common.set('COMI', '')
    this.common.set('COMO', '')
  }

  async run(): Promise<RunResult> {
    const t0 = performance.now()
    try {
      this.indexLabels(this.unit.statements)
      const ctrl = await this.execBlock(this.unit.statements)
      if (ctrl.type === 'abort') {
        return {
          ok: false,
          exitCode: 1,
          stopped: true,
          elapsedMs: performance.now() - t0,
          error: {
            severity: 'error',
            file: this.unit.fileName,
            line: 0,
            code: 'TAFJ-ABORT',
            message: 'Program ABORT',
          },
        }
      }
      return {
        ok: true,
        exitCode: ctrl.type === 'stop' ? ctrl.code : 0,
        stopped: ctrl.type === 'stop',
        elapsedMs: performance.now() - t0,
      }
    } catch (e) {
      const err = e as RuntimeError
      const compileErr: CompileError = {
        severity: 'error',
        file: this.unit.fileName,
        line: err.line || 1,
        code: err.code || 'TAFJ-RT',
        message: err.message,
      }
      this.hooks.log('ERROR', `${compileErr.file}:${compileErr.line}: [${compileErr.code}] ${compileErr.message}`)
      return {
        ok: false,
        exitCode: 1,
        stopped: true,
        error: compileErr,
        elapsedMs: performance.now() - t0,
      }
    }
  }

  private indexLabels(stmts: Statement[]): void {
    stmts.forEach((s, i) => {
      if (s.kind === 'label') {
        this.labelIndex.set(s.name, { stmts, index: i })
      }
      if (s.kind === 'if') {
        this.indexLabels(s.thenBranch)
        this.indexLabels(s.elseBranch)
      }
      if (s.kind === 'for') this.indexLabels(s.body)
      if (s.kind === 'loop') this.indexLabels(s.body)
    })
  }

  private async execBlock(stmts: Statement[], from = 0): Promise<Control> {
    for (let i = from; i < stmts.length; i++) {
      if (++this.stepCount > this.maxSteps) {
        throw new RuntimeError('Execution limit exceeded (possible infinite loop)', stmts[i]?.line ?? 1, 'TAFJ-LIMIT')
      }
      const s = stmts[i]!
      const ctrl = await this.exec(s, stmts, i)
      if (ctrl.type === 'goto') {
        const target = this.labelIndex.get(ctrl.label)
        if (!target) throw new RuntimeError(`Label '${ctrl.label}' not found`, s.line, 'TAFJ-LABEL')
        return this.execBlock(target.stmts, target.index)
      }
      if (ctrl.type !== 'none') return ctrl
    }
    return { type: 'none' }
  }

  private async exec(s: Statement, stmts: Statement[], index: number): Promise<Control> {
    switch (s.kind) {
      case 'empty':
      case 'label':
      case 'program':
      case 'subroutine':
      case 'null':
      case 'dim':
      case 'common':
      case 'insert':
      case 'end':
        return { type: 'none' }

      case 'equate': {
        this.equates.set(s.name, this.eval(s.value))
        return { type: 'none' }
      }

      case 'assign': {
        this.assign(s.target, this.eval(s.value))
        return { type: 'none' }
      }

      case 'crt':
      case 'print': {
        const text = s.exprs.map((e) => asString(this.eval(e))).join('')
        this.hooks.write(text, !s.suppressNl)
        return { type: 'none' }
      }

      case 'if': {
        if (isTruthy(this.eval(s.condition))) {
          return this.execBlock(s.thenBranch)
        }
        return this.execBlock(s.elseBranch)
      }

      case 'for': {
        const from = asNumber(this.eval(s.from))
        const to = asNumber(this.eval(s.to))
        const step = s.step ? asNumber(this.eval(s.step)) : 1
        this.vars.set(s.variable, String(from))
        if (step >= 0) {
          for (let v = from; v <= to; v += step) {
            this.vars.set(s.variable, String(v))
            const ctrl = await this.execBlock(s.body)
            if (ctrl.type !== 'none') return ctrl
          }
        } else {
          for (let v = from; v >= to; v += step) {
            this.vars.set(s.variable, String(v))
            const ctrl = await this.execBlock(s.body)
            if (ctrl.type !== 'none') return ctrl
          }
        }
        return { type: 'none' }
      }

      case 'loop': {
        while (true) {
          if (s.whileCond && !isTruthy(this.eval(s.whileCond))) break
          if (s.untilCond && isTruthy(this.eval(s.untilCond))) break
          const ctrl = await this.execBlock(s.body)
          if (ctrl.type !== 'none') return ctrl
          if (s.whileCond && !isTruthy(this.eval(s.whileCond))) break
          if (s.untilCond && isTruthy(this.eval(s.untilCond))) break
          // If no while/until, require break via STOP/RETURN — still guard infinite
          if (!s.whileCond && !s.untilCond) {
            // allow one-shot body then check until at end pattern handled above
            // Infinite LOOP without condition: keep going until STOP
          }
        }
        return { type: 'none' }
      }

      case 'gosub': {
        this.gosubStack.push({ stmts, index: index + 1 })
        const target = this.labelIndex.get(s.label)
        if (!target) throw new RuntimeError(`GOSUB label '${s.label}' not found`, s.line, 'TAFJ-LABEL')
        const ctrl = await this.execBlock(target.stmts, target.index)
        if (ctrl.type === 'return') {
          const frame = this.gosubStack.pop()
          if (frame) return this.execBlock(frame.stmts, frame.index)
          return { type: 'none' }
        }
        return ctrl
      }

      case 'goto':
        return { type: 'goto', label: s.label }

      case 'return': {
        if (this.gosubStack.length) {
          return { type: 'return', value: s.value ? this.eval(s.value) : undefined }
        }
        return { type: 'return', value: s.value ? this.eval(s.value) : undefined }
      }

      case 'stop': {
        const code = s.code ? asNumber(this.eval(s.code)) : 0
        if (s.message) this.hooks.write(asString(this.eval(s.message)), true)
        this.hooks.log('INFO', `STOP ${code}`)
        return { type: 'stop', code }
      }

      case 'abort': {
        if (s.message) this.hooks.write(asString(this.eval(s.message)), true)
        return { type: 'abort' }
      }

      case 'call': {
        const routine = this.hooks.getRoutine(s.name)
        if (!routine) {
          throw new RuntimeError(`Unable to call subroutine '${s.name}' — not compiled/catalogued`, s.line, 'TAFJ-CALL')
        }
        const child = new Interpreter(routine, this.hooks, this.inputQueue)
        // pass args into ARG.1 style / named
        s.args.forEach((a, i) => {
          child.vars.set(`ARG.${i + 1}`, this.eval(a))
          if (routine.statements[0]?.kind === 'subroutine') {
            const name = routine.statements[0].args[i]
            if (name) child.vars.set(name, this.eval(a))
          }
        })
        // share COMMON + VFS vars by reference maps
        child.common = this.common
        const result = await child.run()
        if (!result.ok && result.error) throw new RuntimeError(result.error.message, s.line, result.error.code)
        // copy back by-ref naive: variables with same names in args if they were vars
        return { type: 'none' }
      }

      case 'open': {
        const path = asString(this.eval(s.path))
        const ok = globalVfs.open(path, s.toVar)
        this.vars.set(s.toVar, path)
        if (!ok && s.elseBranch?.length) return this.execBlock(s.elseBranch)
        return { type: 'none' }
      }

      case 'read': {
        const id = asString(this.eval(s.id))
        const rec = globalVfs.read(s.fromVar, id)
        if (rec === null) {
          this.vars.set(s.varName, '')
          if (s.elseBranch?.length) return this.execBlock(s.elseBranch)
          // classic: fall through; many programs use ELSE STOP
          return { type: 'none' }
        }
        this.vars.set(s.varName, rec)
        return { type: 'none' }
      }

      case 'write': {
        const id = asString(this.eval(s.id))
        const body = asString(this.eval(s.value))
        if (!globalVfs.write(s.onVar, id, body)) {
          throw new RuntimeError(`WRITE failed — file '${s.onVar}' is not OPEN`, s.line, 'TAFJ-FILE')
        }
        return { type: 'none' }
      }

      case 'delete': {
        const id = asString(this.eval(s.id))
        globalVfs.delete(s.fromVar, id)
        return { type: 'none' }
      }

      case 'close': {
        globalVfs.close(s.varName)
        return { type: 'none' }
      }

      case 'clearfile': {
        globalVfs.clear(s.varName)
        return { type: 'none' }
      }

      case 'input': {
        let value: string
        if (this.inputQueue.length) {
          value = this.inputQueue.shift()!
          this.hooks.write(`? ${value}`, true)
        } else {
          value = await this.hooks.input('? ')
        }
        this.vars.set(s.varName, value)
        return { type: 'none' }
      }

      case 'execute': {
        const cmd = asString(this.eval(s.command))
        this.hooks.log('INFO', `EXECUTE ${cmd} (simulated — no OS shell)`)
        this.hooks.write(`[EXECUTE] ${cmd}`, true)
        return { type: 'none' }
      }

      case 'exprStmt':
        this.eval(s.expr)
        return { type: 'none' }

      default:
        return { type: 'none' }
    }
  }

  private eval(expr: Expr): JbValue {
    switch (expr.kind) {
      case 'number':
        return String(expr.value)
      case 'string':
        return expr.value
      case 'var': {
        const n = expr.name
        if (this.equates.has(n)) return this.equates.get(n)!
        if (this.common.has(n)) return this.common.get(n)!
        if (this.vars.has(n)) return this.vars.get(n)!
        // @variables
        if (n.startsWith('@')) return this.atVar(n)
        return ''
      }
      case 'unary': {
        const v = this.eval(expr.expr)
        if (expr.op === 'NOT') return isTruthy(v) ? '0' : '1'
        if (expr.op === '-') return formatNumber(-asNumber(v))
        return v
      }
      case 'binary': {
        if (expr.op === 'AND') return isTruthy(this.eval(expr.left)) && isTruthy(this.eval(expr.right)) ? '1' : '0'
        if (expr.op === 'OR') return isTruthy(this.eval(expr.left)) || isTruthy(this.eval(expr.right)) ? '1' : '0'
        if (['=', ':=', '<>', '#', '>', '<', '>=', '<='].includes(expr.op)) {
          return compare(this.eval(expr.left), this.eval(expr.right), expr.op) ? '1' : '0'
        }
        const l = asNumber(this.eval(expr.left))
        const r = asNumber(this.eval(expr.right))
        switch (expr.op) {
          case '+':
            return formatNumber(l + r)
          case '-':
            return formatNumber(l - r)
          case '*':
            return formatNumber(l * r)
          case '/':
            return formatNumber(r === 0 ? 0 : l / r)
          case '^':
            return formatNumber(l ** r)
          default:
            return ''
        }
      }
      case 'cat':
        return expr.parts.map((p) => asString(this.eval(p))).join('')
      case 'call': {
        const fn = builtins[expr.name]
        if (!fn) throw new RuntimeError(`Unknown function '${expr.name}'`, 0, 'TAFJ-FN')
        return fn(expr.args.map((a) => this.eval(a)))
      }
      case 'extract': {
        const base = this.eval(expr.base)
        const idx = expr.indices.map((i) => asNumber(this.eval(i)))
        return extract(base, idx[0] ?? 1, idx[1], idx[2])
      }
      case 'substring': {
        const base = this.eval(expr.base)
        const start = asNumber(this.eval(expr.start))
        const len = expr.length ? asNumber(this.eval(expr.length)) : undefined
        return substring(base, start, len)
      }
    }
  }

  private assign(target: LValue, value: JbValue): void {
    if (target.kind === 'var') {
      if (this.common.has(target.name) || ['ID.NEW', 'ID.OLD', 'ETEXT', 'MESSAGE', 'COMI', 'COMO'].includes(target.name)) {
        this.common.set(target.name, value)
      }
      this.vars.set(target.name, value)
      return
    }
    if (target.kind === 'extract') {
      const current = this.readLValue(target.base)
      const idx = target.indices.map((i) => asNumber(this.eval(i)))
      const next = replaceExtract(current, value, idx[0] ?? 1, idx[1], idx[2])
      this.assign(target.base, next)
      return
    }
    if (target.kind === 'substring') {
      const current = this.readLValue(target.base)
      const start = asNumber(this.eval(target.start))
      const len = target.length ? asNumber(this.eval(target.length)) : value.length
      const from = Math.max(0, start - 1)
      const next = current.slice(0, from) + value.slice(0, len) + current.slice(from + len)
      this.assign(target.base, next)
    }
  }

  private readLValue(target: LValue): JbValue {
    return this.eval(lvalueToExpr(target))
  }

  private atVar(name: string): JbValue {
    switch (name) {
      case '@DATE':
        return builtins.DATE([])
      case '@TIME':
        return builtins.TIME([])
      case '@USER':
      case '@LOGNAME':
        return 'LEARNER'
      case '@PATH':
        return '/JB.SIMULATOR'
      case '@ID':
        return this.common.get('ID.NEW') ?? ''
      case '@RECORD':
        return ''
      default:
        return ''
    }
  }
}

function lvalueToExpr(lv: LValue): Expr {
  if (lv.kind === 'var') return { kind: 'var', name: lv.name }
  if (lv.kind === 'extract') return { kind: 'extract', base: lvalueToExpr(lv.base), indices: lv.indices }
  return { kind: 'substring', base: lvalueToExpr(lv.base), start: lv.start, length: lv.length }
}

export async function runUnit(
  unit: CompiledUnit,
  hooks: RuntimeHooks,
  inputQueue: string[] = [],
): Promise<RunResult> {
  const interp = new Interpreter(unit, hooks, inputQueue)
  return interp.run()
}
