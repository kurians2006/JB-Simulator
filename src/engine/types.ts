export type JbValue = string

export const FM = String.fromCharCode(254)
export const VM = String.fromCharCode(253)
export const SM = String.fromCharCode(252)

export interface CompileError {
  severity: 'error' | 'warning' | 'info'
  file: string
  line: number
  column?: number
  code: string
  message: string
}

export interface CompileLogLine {
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
  text: string
}

export interface CompileResult {
  ok: boolean
  programName: string
  programType: 'PROGRAM' | 'SUBROUTINE' | 'ANONYMOUS'
  logs: CompileLogLine[]
  errors: CompileError[]
  unit: CompiledUnit | null
}

export interface CompiledUnit {
  name: string
  type: 'PROGRAM' | 'SUBROUTINE' | 'ANONYMOUS'
  source: string
  fileName: string
  statements: Statement[]
  labels: Record<string, number>
}

export type Statement =
  | { kind: 'empty'; line: number }
  | { kind: 'label'; line: number; name: string }
  | { kind: 'program'; line: number; name: string }
  | { kind: 'subroutine'; line: number; name: string; args: string[] }
  | { kind: 'end'; line: number }
  | { kind: 'return'; line: number; value?: Expr }
  | { kind: 'stop'; line: number; code?: Expr; message?: Expr }
  | { kind: 'abort'; line: number; message?: Expr }
  | { kind: 'null'; line: number }
  | { kind: 'crt'; line: number; exprs: Expr[]; suppressNl: boolean }
  | { kind: 'print'; line: number; exprs: Expr[]; suppressNl: boolean }
  | { kind: 'assign'; line: number; target: LValue; value: Expr }
  | { kind: 'if'; line: number; condition: Expr; thenBranch: Statement[]; elseBranch: Statement[] }
  | { kind: 'for'; line: number; variable: string; from: Expr; to: Expr; step?: Expr; body: Statement[] }
  | { kind: 'loop'; line: number; whileCond?: Expr; untilCond?: Expr; body: Statement[] }
  | { kind: 'case'; line: number; branches: Array<{ condition: Expr; body: Statement[] }> }
  | { kind: 'break'; line: number }
  | { kind: 'continue'; line: number }
  | { kind: 'precision'; line: number; digits: Expr }
  | { kind: 'sleep'; line: number; seconds: Expr }
  | { kind: 'gosub'; line: number; label: string }
  | { kind: 'goto'; line: number; label: string }
  | { kind: 'call'; line: number; name: string; args: Expr[] }
  | { kind: 'equate'; line: number; name: string; value: Expr }
  | { kind: 'dim'; line: number; name: string; dims: Expr[] }
  | { kind: 'common'; line: number; named?: string; vars: string[] }
  | { kind: 'insert'; line: number; name: string }
  | { kind: 'open'; line: number; path: Expr; toVar: string; elseBranch?: Statement[] }
  | { kind: 'read'; line: number; varName: string; fromVar: string; id: Expr; elseBranch?: Statement[] }
  | { kind: 'write'; line: number; value: Expr; onVar: string; id: Expr }
  | { kind: 'delete'; line: number; fromVar: string; id: Expr }
  | { kind: 'close'; line: number; varName: string }
  | { kind: 'clearfile'; line: number; varName: string }
  | { kind: 'input'; line: number; varName: string; length?: Expr }
  | { kind: 'execute'; line: number; command: Expr }
  | { kind: 'exprStmt'; line: number; expr: Expr }

export type LValue =
  | { kind: 'var'; name: string }
  | { kind: 'extract'; base: LValue; indices: Expr[] }
  | { kind: 'substring'; base: LValue; start: Expr; length?: Expr }

export type Expr =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'var'; name: string }
  | { kind: 'unary'; op: '-' | 'NOT' | '+'; expr: Expr }
  | { kind: 'binary'; op: string; left: Expr; right: Expr }
  | { kind: 'call'; name: string; args: Expr[] }
  | { kind: 'extract'; base: Expr; indices: Expr[] }
  | { kind: 'substring'; base: Expr; start: Expr; length?: Expr }
  | { kind: 'cat'; parts: Expr[] }

export interface RuntimeHooks {
  write: (text: string, newline: boolean) => void
  log: (level: CompileLogLine['level'], text: string) => void
  input: (prompt: string) => Promise<string>
  getRoutine: (name: string) => CompiledUnit | null
}

export interface RunResult {
  ok: boolean
  exitCode: number
  stopped: boolean
  error?: CompileError
  elapsedMs: number
}
