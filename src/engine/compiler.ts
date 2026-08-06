import { parseSource, type RawLine } from './parser'
import type {
  CompileError,
  CompileLogLine,
  CompileResult,
  CompiledUnit,
  Expr,
  Statement,
} from './types'
import { INSERTS } from '../data/inserts'

function log(logs: CompileLogLine[], level: CompileLogLine['level'], text: string) {
  logs.push({ level, text })
}

function err(
  errors: CompileError[],
  file: string,
  line: number,
  message: string,
  code = 'TAFJ-COMP',
  column?: number,
): void {
  errors.push({ severity: 'error', file, line, column, code, message })
}

/** Expand $INSERT / INSERT by inlining known stubs */
function expandInserts(rawLines: RawLine[], fileName: string, errors: CompileError[]): RawLine[] {
  const out: RawLine[] = []
  for (const rl of rawLines) {
    if (rl.stmt?.kind === 'insert') {
      const body = INSERTS[rl.stmt.name] ?? INSERTS[rl.stmt.name.replace(/^I_/, 'I_')]
      if (!body) {
        err(
          errors,
          fileName,
          rl.line,
          `Cannot find INSERT item '${rl.stmt.name}'`,
          'TAFJ-INSERT',
        )
        out.push(rl)
        continue
      }
      const nested = parseSource(body, `${rl.stmt.name}`)
      for (const n of nested) {
        out.push({ ...n, line: rl.line }) // map errors to insert line for simplicity
      }
      continue
    }
    out.push(rl)
  }
  return out
}

interface BlockFrame {
  type: 'if' | 'for' | 'loop' | 'else'
  stmt: Statement
  thenDone?: boolean
}

function buildBlocks(rawLines: RawLine[], fileName: string, errors: CompileError[]): Statement[] {
  const root: Statement[] = []
  const stack: { list: Statement[]; frame?: BlockFrame }[] = [{ list: root }]

  const current = () => stack[stack.length - 1]!

  for (const rl of rawLines) {
    if (rl.error) {
      errors.push(rl.error)
      continue
    }
    if (!rl.stmt || rl.stmt.kind === 'empty') continue

    // Handle label + rest packed
    const stmt = rl.stmt as Statement & { _rest?: Statement }
    if (stmt.kind === 'label') {
      current().list.push({ kind: 'label', line: stmt.line, name: stmt.name })
      if (stmt._rest) {
        // process rest as if it were the line
        processStmt(stmt._rest)
      }
      continue
    }

    processStmt(stmt)

    function processStmt(s: Statement) {
      // END ELSE (single line)
      if (s.kind === 'exprStmt' && s.expr.kind === 'call' && s.expr.name === '__END_ELSE') {
        const frame = current().frame
        if (!frame || (frame.type !== 'if' && frame.type !== 'else')) {
          err(errors, fileName, s.line, "'END ELSE' without matching 'IF'", 'TAFJ-BLOCK')
          return
        }
        // close THEN, open ELSE
        stack.pop()
        const ifStmt = frame.stmt as Extract<Statement, { kind: 'if' }>
        stack.push({ list: ifStmt.elseBranch, frame: { type: 'else', stmt: ifStmt } })
        return
      }

      // ELSE
      if (s.kind === 'exprStmt' && s.expr.kind === 'call' && s.expr.name === '__ELSE') {
        const frame = current().frame
        if (frame && (frame.type === 'if' || frame.type === 'else')) {
          frame.thenDone = true
          frame.type = 'else'
          stack.pop()
          const ifStmt = frame.stmt as Extract<Statement, { kind: 'if' }>
          stack.push({ list: ifStmt.elseBranch, frame: { type: 'else', stmt: ifStmt } })
          return
        }
        // Attach ELSE to previous OPEN/READ
        const list = current().list
        const prev = list[list.length - 1]
        if (prev && (prev.kind === 'open' || prev.kind === 'read')) {
          if (!prev.elseBranch) prev.elseBranch = []
          stack.push({
            list: prev.elseBranch,
            frame: { type: 'else', stmt: { kind: 'if', line: s.line, condition: { kind: 'number', value: 1 }, thenBranch: [], elseBranch: prev.elseBranch } },
          })
          return
        }
        err(errors, fileName, s.line, "'ELSE' without matching 'IF'/'OPEN'/'READ'", 'TAFJ-BLOCK')
        return
      }

      // WHILE / UNTIL inside LOOP
      if (s.kind === 'exprStmt' && s.expr.kind === 'call' && (s.expr.name === '__WHILE' || s.expr.name === '__UNTIL')) {
        const frame = current().frame
        if (!frame || frame.type !== 'loop') {
          err(errors, fileName, s.line, `'${s.expr.name.slice(2)}' without matching 'LOOP'`, 'TAFJ-BLOCK')
          return
        }
        const loopStmt = frame.stmt as Extract<Statement, { kind: 'loop' }>
        const cond = s.expr.args[0]
        if (cond) {
          if (s.expr.name === '__WHILE') loopStmt.whileCond = cond
          else loopStmt.untilCond = cond
        }
        return
      }

      // REPEAT
      if (s.kind === 'exprStmt' && s.expr.kind === 'call' && s.expr.name === '__REPEAT') {
        if (!current().frame || current().frame?.type !== 'loop') {
          err(errors, fileName, s.line, "'REPEAT' without matching 'LOOP'", 'TAFJ-BLOCK')
          return
        }
        stack.pop()
        return
      }

      // NEXT
      if (s.kind === 'exprStmt' && s.expr.kind === 'call' && s.expr.name === '__NEXT') {
        if (!current().frame || current().frame?.type !== 'for') {
          err(errors, fileName, s.line, "'NEXT' without matching 'FOR'", 'TAFJ-BLOCK')
          return
        }
        stack.pop()
        return
      }

      // END — closes IF or program
      if (s.kind === 'end') {
        const frame = current().frame
        if (frame && (frame.type === 'if' || frame.type === 'else')) {
          stack.pop()
          return
        }
        // program-level END
        current().list.push(s)
        return
      }

      if (s.kind === 'if') {
        current().list.push(s)
        stack.push({ list: s.thenBranch, frame: { type: 'if', stmt: s } })
        return
      }

      if (s.kind === 'for') {
        current().list.push(s)
        stack.push({ list: s.body, frame: { type: 'for', stmt: s } })
        return
      }

      if (s.kind === 'loop') {
        current().list.push(s)
        stack.push({ list: s.body, frame: { type: 'loop', stmt: s } })
        return
      }

      if (s.kind === 'open' || s.kind === 'read') {
        current().list.push(s)
        if ((s as Statement & { _inlineElse?: boolean })._inlineElse) {
          if (!s.elseBranch) s.elseBranch = []
          stack.push({
            list: s.elseBranch,
            frame: {
              type: 'else',
              stmt: {
                kind: 'if',
                line: s.line,
                condition: { kind: 'number', value: 1 },
                thenBranch: [],
                elseBranch: s.elseBranch,
              },
            },
          })
        }
        return
      }

      // OPEN/READ with ELSE on same conceptual block — support next-line ELSE via IF-like:
      // For MVP: OPEN ... ELSE ... END  using same ELSE/END as IF when previous was open/read
      if (s.kind === 'exprStmt' && s.expr.kind === 'call' && s.expr.name === '__ELSE') {
        // already handled
      }

      current().list.push(s)
    }
  }

  while (stack.length > 1) {
    const frame = current().frame
    err(
      errors,
      fileName,
      (frame?.stmt as { line?: number })?.line ?? 1,
      `Unclosed '${frame?.type?.toUpperCase() ?? 'BLOCK'}' block — missing END/NEXT/REPEAT`,
      'TAFJ-BLOCK',
    )
    stack.pop()
  }

  return root
}

function collectLabels(stmts: Statement[], labels: Record<string, number>, list = stmts, base = 0): void {
  // Flatten for label index within top-level sequential execution using a linear list
  void list
  void base
  // Labels are resolved at runtime within statement arrays recursively
  for (const s of stmts) {
    if (s.kind === 'label') labels[s.name] = s.line
    if (s.kind === 'if') {
      collectLabels(s.thenBranch, labels)
      collectLabels(s.elseBranch, labels)
    }
    if (s.kind === 'for') collectLabels(s.body, labels)
    if (s.kind === 'loop') collectLabels(s.body, labels)
  }
}

function validateReservedAssignments(stmts: Statement[], fileName: string, errors: CompileError[]): void {
  const walk = (list: Statement[]) => {
    for (const s of list) {
      if (s.kind === 'assign' && s.target.kind === 'var') {
        const reserved = [
          'CRT', 'PRINT', 'IF', 'THEN', 'ELSE', 'END', 'FOR', 'NEXT', 'LOOP', 'REPEAT',
          'WHILE', 'UNTIL', 'GOSUB', 'GOTO', 'CALL', 'RETURN', 'STOP', 'OPEN', 'READ', 'WRITE',
        ]
        if (reserved.includes(s.target.name)) {
          err(
            errors,
            fileName,
            s.line,
            `Identifier '${s.target.name}' is a reserved word and cannot be used as a variable`,
            'TAFJ-RESERVED',
          )
        }
      }
      if (s.kind === 'if') {
        walk(s.thenBranch)
        walk(s.elseBranch)
      }
      if (s.kind === 'for') walk(s.body)
      if (s.kind === 'loop') walk(s.body)
    }
  }
  walk(stmts)
}

export function compileSource(source: string, fileName: string): CompileResult {
  const logs: CompileLogLine[] = []
  const errors: CompileError[] = []
  const shortName = fileName.split('/').pop() ?? fileName

  log(logs, 'INFO', `tCompile ${fileName}`)
  log(logs, 'INFO', `Analyzing ${shortName} ...`)
  log(logs, 'INFO', 'Grammar detected: jBASE / InfoBASIC')
  log(logs, 'DEBUG', 'Pass 1: lexical analysis')

  let raw = parseSource(source, fileName)
  log(logs, 'DEBUG', `Pass 2: expanding INSERT (${raw.filter((r) => r.stmt?.kind === 'insert').length} item(s))`)
  raw = expandInserts(raw, fileName, errors)

  log(logs, 'DEBUG', 'Pass 3: syntax & block structure')
  const statements = buildBlocks(raw, fileName, errors)

  let programName = shortName.replace(/\.b$/i, '').toUpperCase()
  let programType: CompiledUnit['type'] = 'ANONYMOUS'

  for (const s of statements) {
    if (s.kind === 'program') {
      programName = s.name
      programType = 'PROGRAM'
      break
    }
    if (s.kind === 'subroutine') {
      programName = s.name
      programType = 'SUBROUTINE'
      break
    }
  }

  validateReservedAssignments(statements, fileName, errors)

  const labels: Record<string, number> = {}
  collectLabels(statements, labels)

  if (errors.length) {
    log(logs, 'ERROR', `Compilation failed with ${errors.length} error(s)`)
    for (const e of errors) {
      log(logs, 'ERROR', `${e.file}:${e.line}${e.column ? ':' + e.column : ''}: [${e.code}] ${e.message}`)
    }
    return { ok: false, programName, programType, logs, errors, unit: null }
  }

  log(logs, 'INFO', 'Generating intermediate representation ...')
  log(logs, 'INFO', 'Compiling to runtime unit ...')
  log(
    logs,
    'INFO',
    `Compiled successfully: ${programType === 'SUBROUTINE' ? 'SUBROUTINE' : 'PROGRAM'} ${programName}`,
  )
  if (programType === 'SUBROUTINE') {
    log(logs, 'INFO', `Catalogued library entry: lib/${programName}.class (simulated)`)
  } else {
    log(logs, 'INFO', `Catalogued binary entry: bin/${programName} (simulated)`)
  }

  const unit: CompiledUnit = {
    name: programName,
    type: programType,
    source,
    fileName,
    statements,
    labels,
  }

  return { ok: true, programName, programType, logs, errors, unit }
}

export function formatExpr(expr: Expr): string {
  switch (expr.kind) {
    case 'number':
      return String(expr.value)
    case 'string':
      return `"${expr.value}"`
    case 'var':
      return expr.name
    case 'call':
      return `${expr.name}(${expr.args.map(formatExpr).join(',')})`
    case 'cat':
      return expr.parts.map(formatExpr).join(':')
    case 'binary':
      return `(${formatExpr(expr.left)} ${expr.op} ${formatExpr(expr.right)})`
    case 'unary':
      return `${expr.op}${formatExpr(expr.expr)}`
    case 'extract':
      return `${formatExpr(expr.base)}<${expr.indices.map(formatExpr).join(',')}>`
    case 'substring':
      return `${formatExpr(expr.base)}[${formatExpr(expr.start)}${expr.length ? ',' + formatExpr(expr.length) : ''}]`
  }
}
