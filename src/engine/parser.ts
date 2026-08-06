import { RESERVED, tokenizeLine, type Token } from './lexer'
import type { CompileError, Expr, LValue, Statement } from './types'

export class ParseError extends Error {
  line: number
  column: number
  code: string
  constructor(message: string, line: number, column: number, code = 'JB-SYNTAX') {
    super(message)
    this.line = line
    this.column = column
    this.code = code
  }
}

class LineParser {
  private i = 0
  private tokens: Token[]
  line: number
  constructor(tokens: Token[], line: number) {
    this.tokens = tokens
    this.line = line
  }

  peek(offset = 0): Token {
    return this.tokens[this.i + offset] ?? { type: 'EOF', value: '', line: this.line, column: 1 }
  }

  match(...types: Token['type'][]): Token | null {
    const t = this.peek()
    if (types.includes(t.type)) {
      this.i++
      return t
    }
    return null
  }

  matchIdent(...values: string[]): Token | null {
    const t = this.peek()
    if (t.type === 'IDENT' && values.includes(t.value)) {
      this.i++
      return t
    }
    return null
  }

  expect(type: Token['type'], msg?: string): Token {
    const t = this.match(type)
    if (!t) {
      const cur = this.peek()
      throw new ParseError(msg ?? `Expected ${type}, found '${cur.value || cur.type}'`, this.line, cur.column)
    }
    return t
  }

  expectIdent(msg?: string): Token {
    return this.expect('IDENT', msg)
  }

  atEnd(): boolean {
    const t = this.peek()
    return t.type === 'EOL' || t.type === 'EOF'
  }

  parseStatement(): Statement | null {
    if (this.atEnd()) return { kind: 'empty', line: this.line }

    // LABEL: statement
    if (this.peek().type === 'IDENT' && this.peek(1).type === 'COLON' && !RESERVED.has(this.peek().value)) {
      const name = this.expectIdent().value
      this.expect('COLON')
      if (this.atEnd()) return { kind: 'label', line: this.line, name }
      // label followed by statement on same line
      const rest = this.parseStatement()
      if (!rest) return { kind: 'label', line: this.line, name }
      // Represent as label then rely on compile to register; keep statement separately via wrapper
      return { kind: 'label', line: this.line, name, ...(rest as object), _rest: rest } as Statement
    }

    if (this.matchIdent('PROGRAM')) {
      const name = this.expectIdent('Program name expected').value
      return { kind: 'program', line: this.line, name }
    }

    if (this.matchIdent('SUBROUTINE')) {
      const name = this.expectIdent('Subroutine name expected').value
      const args: string[] = []
      if (this.match('LPAREN')) {
        if (!this.match('RPAREN')) {
          do {
            args.push(this.expectIdent().value)
          } while (this.match('COMMA'))
          this.expect('RPAREN')
        }
      }
      return { kind: 'subroutine', line: this.line, name, args }
    }

    if (this.matchIdent('END')) {
      // Support "END ELSE" on one line (common InfoBASIC style)
      if (this.matchIdent('ELSE')) {
        return {
          kind: 'exprStmt',
          line: this.line,
          expr: { kind: 'call', name: '__END_ELSE', args: [] },
        }
      }
      return { kind: 'end', line: this.line }
    }
    if (this.matchIdent('RETURN')) {
      if (!this.atEnd()) {
        return { kind: 'return', line: this.line, value: this.parseExpr() }
      }
      return { kind: 'return', line: this.line }
    }
    if (this.matchIdent('STOP')) {
      const code = !this.atEnd() ? this.parseExpr() : undefined
      let message: Expr | undefined
      if (this.match('COMMA')) message = this.parseExpr()
      return { kind: 'stop', line: this.line, code, message }
    }
    if (this.matchIdent('ABORT')) {
      const message = !this.atEnd() ? this.parseExpr() : undefined
      return { kind: 'abort', line: this.line, message }
    }
    if (this.matchIdent('NULL')) return { kind: 'null', line: this.line }

    if (this.matchIdent('CRT') || this.matchIdent('PRINT')) {
      const kind = this.tokens[this.i - 1]!.value === 'CRT' ? 'crt' : 'print'
      const exprs: Expr[] = []
      let suppressNl = false
      if (!this.atEnd()) {
        exprs.push(this.parseExpr())
        while (this.match('COLON') || this.match('COMMA')) {
          if (this.atEnd()) {
            suppressNl = true
            break
          }
          exprs.push(this.parseExpr())
        }
        if (this.match('COLON') && this.atEnd()) suppressNl = true
      }
      return { kind, line: this.line, exprs, suppressNl }
    }

    if (this.matchIdent('IF')) {
      const condition = this.parseExpr()
      this.matchIdent('THEN') // optional THEN
      return { kind: 'if', line: this.line, condition, thenBranch: [], elseBranch: [] }
    }

    if (this.matchIdent('FOR')) {
      const variable = this.expectIdent().value
      const eq = this.expect('OP', '= expected in FOR')
      if (eq.value !== '=') {
        throw new ParseError('FOR requires =', this.line, eq.column)
      }
      const from = this.parseExpr()
      this.matchIdent('TO')
      const to = this.parseExpr()
      let step: Expr | undefined
      if (this.matchIdent('STEP')) step = this.parseExpr()
      return { kind: 'for', line: this.line, variable, from, to, step, body: [] }
    }

    if (this.matchIdent('LOOP')) {
      return { kind: 'loop', line: this.line, body: [] }
    }

    if (this.matchIdent('WHILE') || this.matchIdent('UNTIL')) {
      // Handled at block level — surface as exprStmt marker via special
      const which = this.tokens[this.i - 1]!.value
      const cond = this.parseExpr()
      this.matchIdent('DO')
      return {
        kind: 'exprStmt',
        line: this.line,
        expr: { kind: 'call', name: `__${which}`, args: [cond] },
      }
    }

    if (this.matchIdent('REPEAT') || this.matchIdent('NEXT') || this.matchIdent('ELSE') || this.matchIdent('CASE')) {
      return {
        kind: 'exprStmt',
        line: this.line,
        expr: { kind: 'call', name: `__${this.tokens[this.i - 1]!.value}`, args: [] },
      }
    }

    if (this.matchIdent('GOSUB')) {
      return { kind: 'gosub', line: this.line, label: this.expectIdent().value }
    }
    if (this.matchIdent('GOTO') || this.matchIdent('GO')) {
      this.matchIdent('TO')
      return { kind: 'goto', line: this.line, label: this.expectIdent().value }
    }

    if (this.matchIdent('CALL')) {
      const name = this.expectIdent().value
      const args: Expr[] = []
      if (this.match('LPAREN')) {
        if (!this.match('RPAREN')) {
          do {
            args.push(this.parseExpr())
          } while (this.match('COMMA'))
          this.expect('RPAREN')
        }
      }
      return { kind: 'call', line: this.line, name, args }
    }

    if (this.matchIdent('EQUATE') || this.matchIdent('EQU')) {
      const name = this.expectIdent().value
      this.matchIdent('TO')
      if (this.match('OP') && this.tokens[this.i - 1]!.value === '=') {
        // EQUATE X = 1
      }
      const value = this.parseExpr()
      return { kind: 'equate', line: this.line, name, value }
    }

    if (this.matchIdent('DIM') || this.matchIdent('DIMENSION')) {
      const name = this.expectIdent().value
      const dims: Expr[] = []
      if (this.match('LPAREN') || this.match('LBRACK')) {
        const closer = this.tokens[this.i - 1]!.type === 'LPAREN' ? 'RPAREN' : 'RBRACK'
        do {
          dims.push(this.parseExpr())
        } while (this.match('COMMA'))
        this.expect(closer as Token['type'])
      }
      return { kind: 'dim', line: this.line, name, dims }
    }

    if (this.matchIdent('COMMON')) {
      let named: string | undefined
      if (this.match('OP') && this.tokens[this.i - 1]!.value === '/') {
        // COMMON /NAME/ A,B — simplified
      }
      if (this.peek().type === 'OP' && this.peek().value === '/') {
        this.match('OP')
        named = this.expectIdent().value
        this.expect('OP')
      }
      const vars: string[] = []
      do {
        vars.push(this.expectIdent().value)
      } while (this.match('COMMA'))
      return { kind: 'common', line: this.line, named, vars }
    }

    if (this.matchIdent('INSERT') || this.matchIdent('$INSERT') || this.matchIdent('INCLUDE') || this.matchIdent('$INCLUDE')) {
      // $INSERT may be tokenized weirdly — handle IDENT starting with $
      const nameTok = this.peek()
      let name = ''
      if (nameTok.type === 'IDENT') {
        name = this.expectIdent().value
      } else {
        throw new ParseError('INSERT name expected', this.line, nameTok.column)
      }
      return { kind: 'insert', line: this.line, name }
    }

    // Handle $INSERT as IDENT "$INSERT" already
    if (this.peek().type === 'IDENT' && this.peek().value.startsWith('$')) {
      const kw = this.expectIdent().value
      if (kw === '$INSERT' || kw === '$INCLUDE') {
        return { kind: 'insert', line: this.line, name: this.expectIdent().value }
      }
      // fallthrough as variable starting with $
      this.i--
    }

    if (this.matchIdent('OPEN')) {
      const path = this.parseExpr()
      this.matchIdent('TO')
      const toVar = this.expectIdent().value
      const elseBranch: Statement[] = []
      const hasElse = !!this.matchIdent('ELSE')
      return { kind: 'open', line: this.line, path, toVar, elseBranch, ...(hasElse ? { _inlineElse: true } : {}) } as Statement
    }

    if (this.matchIdent('READ')) {
      const varName = this.expectIdent().value
      this.matchIdent('FROM')
      const fromVar = this.expectIdent().value
      this.match('COMMA')
      const id = this.parseExpr()
      const elseBranch: Statement[] = []
      const hasElse = !!this.matchIdent('ELSE')
      return { kind: 'read', line: this.line, varName, fromVar, id, elseBranch, ...(hasElse ? { _inlineElse: true } : {}) } as Statement
    }

    if (this.matchIdent('WRITE')) {
      const value = this.parseExpr()
      this.matchIdent('ON') || this.matchIdent('TO')
      const onVar = this.expectIdent().value
      this.match('COMMA')
      const id = this.parseExpr()
      return { kind: 'write', line: this.line, value, onVar, id }
    }

    if (this.matchIdent('DELETE')) {
      this.matchIdent('FROM')
      const fromVar = this.expectIdent().value
      this.match('COMMA')
      const id = this.parseExpr()
      return { kind: 'delete', line: this.line, fromVar, id }
    }

    if (this.matchIdent('CLOSE')) {
      return { kind: 'close', line: this.line, varName: this.expectIdent().value }
    }

    if (this.matchIdent('CLEARFILE')) {
      return { kind: 'clearfile', line: this.line, varName: this.expectIdent().value }
    }

    if (this.matchIdent('INPUT')) {
      const varName = this.expectIdent().value
      let length: Expr | undefined
      if (this.match('COMMA')) length = this.parseExpr()
      return { kind: 'input', line: this.line, varName, length }
    }

    if (this.matchIdent('EXECUTE') || this.matchIdent('PERFORM')) {
      return { kind: 'execute', line: this.line, command: this.parseExpr() }
    }

    // Assignment or expression
    const lhs = this.parseLValue()
    if (this.match('OP') && ['=', ':=', '+=', '-=', '*='].includes(this.tokens[this.i - 1]!.value)) {
      const op = this.tokens[this.i - 1]!.value
      const rhs = this.parseExpr()
      if (op === '=') return { kind: 'assign', line: this.line, target: lhs, value: rhs }
      if (op === ':=') return { kind: 'assign', line: this.line, target: lhs, value: rhs }
      const binOp = op[0]!
      return {
        kind: 'assign',
        line: this.line,
        target: lhs,
        value: { kind: 'binary', op: binOp, left: lvalueToExpr(lhs), right: rhs },
      }
    }

    // CALL-less function as statement
    return { kind: 'exprStmt', line: this.line, expr: lvalueToExpr(lhs) }
  }

  parseLValue(): LValue {
    const name = this.expectIdent('Variable name expected').value
    let base: LValue = { kind: 'var', name }

    while (true) {
      if (this.match('LT')) {
        const indices: Expr[] = []
        do {
          indices.push(this.parseExpr())
        } while (this.match('COMMA'))
        this.expect('GT', 'Expected > to close extract')
        base = { kind: 'extract', base, indices }
        continue
      }
      if (this.match('LBRACK')) {
        const start = this.parseExpr()
        let length: Expr | undefined
        if (this.match('COMMA')) length = this.parseExpr()
        this.expect('RBRACK')
        base = { kind: 'substring', base, start, length }
        continue
      }
      break
    }
    return base
  }

  parseExpr(): Expr {
    return this.parseOr()
  }

  private parseOr(): Expr {
    let left = this.parseAnd()
    while (this.matchIdent('OR') || (this.match('OP') && this.tokens[this.i - 1]!.value === '!')) {
      // ! sometimes used? stick to OR
      const right = this.parseAnd()
      left = { kind: 'binary', op: 'OR', left, right }
    }
    return left
  }

  private parseAnd(): Expr {
    let left = this.parseEquality()
    while (this.matchIdent('AND')) {
      const right = this.parseEquality()
      left = { kind: 'binary', op: 'AND', left, right }
    }
    return left
  }

  private parseEquality(): Expr {
    let left = this.parseRelational()
    while (true) {
      if (this.matchIdent('EQ')) {
        left = { kind: 'binary', op: '=', left, right: this.parseRelational() }
        continue
      }
      if (this.matchIdent('NE')) {
        left = { kind: 'binary', op: '<>', left, right: this.parseRelational() }
        continue
      }
      if (this.match('OP') && ['=', '<>', '#', ':='].includes(this.tokens[this.i - 1]!.value)) {
        const op = this.tokens[this.i - 1]!.value === '#' ? '<>' : this.tokens[this.i - 1]!.value
        left = { kind: 'binary', op, left, right: this.parseRelational() }
        continue
      }
      break
    }
    return left
  }

  private parseRelational(): Expr {
    let left = this.parseConcat()
    while (true) {
      if (this.matchIdent('GT') || this.matchIdent('LT') || this.matchIdent('GE') || this.matchIdent('LE')) {
        const op = this.tokens[this.i - 1]!.value
        const map: Record<string, string> = { GT: '>', LT: '<', GE: '>=', LE: '<=' }
        left = { kind: 'binary', op: map[op]!, left, right: this.parseConcat() }
        continue
      }
      if (this.match('OP') && ['>', '<', '>=', '<='].includes(this.tokens[this.i - 1]!.value)) {
        const op = this.tokens[this.i - 1]!.value
        left = { kind: 'binary', op, left, right: this.parseConcat() }
        continue
      }
      // bare < > already used for extracts — comparison uses GT/LT keywords preferably
      break
    }
    return left
  }

  private parseConcat(): Expr {
    let left = this.parseAdd()
    const parts: Expr[] = [left]
    let concat = false
    while (this.match('COLON')) {
      concat = true
      parts.push(this.parseAdd())
    }
    if (concat) return { kind: 'cat', parts }
    return left
  }

  private parseAdd(): Expr {
    let left = this.parseMul()
    while (this.match('OP') && ['+', '-'].includes(this.tokens[this.i - 1]!.value)) {
      const op = this.tokens[this.i - 1]!.value
      left = { kind: 'binary', op, left, right: this.parseMul() }
    }
    return left
  }

  private parseMul(): Expr {
    let left = this.parseUnary()
    while (this.match('OP') && ['*', '/', '^', '**'].includes(this.tokens[this.i - 1]!.value)) {
      let op = this.tokens[this.i - 1]!.value
      if (op === '**') op = '^'
      left = { kind: 'binary', op, left, right: this.parseUnary() }
    }
    return left
  }

  private parseUnary(): Expr {
    if (this.matchIdent('NOT')) {
      return { kind: 'unary', op: 'NOT', expr: this.parseUnary() }
    }
    if (this.match('OP') && ['-', '+'].includes(this.tokens[this.i - 1]!.value)) {
      const op = this.tokens[this.i - 1]!.value as '-' | '+'
      return { kind: 'unary', op, expr: this.parseUnary() }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): Expr {
    if (this.match('NUMBER')) {
      return { kind: 'number', value: Number(this.tokens[this.i - 1]!.value) }
    }
    if (this.match('STRING')) {
      return { kind: 'string', value: this.tokens[this.i - 1]!.value }
    }
    if (this.match('LPAREN')) {
      const e = this.parseExpr()
      this.expect('RPAREN')
      return e
    }
    if (this.match('IDENT')) {
      const name = this.tokens[this.i - 1]!.value
      // function call
      if (this.match('LPAREN')) {
        const args: Expr[] = []
        if (!this.match('RPAREN')) {
          do {
            args.push(this.parseExpr())
          } while (this.match('COMMA'))
          this.expect('RPAREN')
        }
        let expr: Expr = { kind: 'call', name, args }
        expr = this.parsePostfix(expr)
        return expr
      }
      let expr: Expr = { kind: 'var', name }
      expr = this.parsePostfix(expr)
      return expr
    }
    const t = this.peek()
    throw new ParseError(`Unexpected token '${t.value || t.type}'`, this.line, t.column)
  }

  private parsePostfix(expr: Expr): Expr {
    while (true) {
      if (this.match('LT')) {
        const indices: Expr[] = []
        do {
          indices.push(this.parseExpr())
        } while (this.match('COMMA'))
        this.expect('GT')
        expr = { kind: 'extract', base: expr, indices }
        continue
      }
      if (this.match('LBRACK')) {
        const start = this.parseExpr()
        let length: Expr | undefined
        if (this.match('COMMA')) length = this.parseExpr()
        this.expect('RBRACK')
        expr = { kind: 'substring', base: expr, start, length }
        continue
      }
      break
    }
    return expr
  }
}

function lvalueToExpr(lv: LValue): Expr {
  if (lv.kind === 'var') return { kind: 'var', name: lv.name }
  if (lv.kind === 'extract') return { kind: 'extract', base: lvalueToExpr(lv.base), indices: lv.indices }
  return { kind: 'substring', base: lvalueToExpr(lv.base), start: lv.start, length: lv.length }
}

export interface RawLine {
  line: number
  text: string
  stmt: Statement | null
  error?: CompileError
}

export function parseSource(source: string, fileName: string): RawLine[] {
  const lines = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const result: RawLine[] = []

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNo = idx + 1
    let text = lines[idx] ?? ''
    // Remove leading $INSERT style already handled
    const trimmed = text.trim()
    if (trimmed === '' || trimmed.startsWith('*') || /^REM(\s|$)/i.test(trimmed)) {
      result.push({ line: lineNo, text, stmt: { kind: 'empty', line: lineNo } })
      continue
    }

    // Normalize $INSERT / $INCLUDE
    if (/^\$INSERT\b/i.test(trimmed) || /^\$INCLUDE\b/i.test(trimmed)) {
      text = trimmed.replace(/^\$/i, '')
    }

    try {
      const tokens = tokenizeLine(text, lineNo)
      const parser = new LineParser(tokens, lineNo)
      const stmt = parser.parseStatement()
      result.push({ line: lineNo, text, stmt })
    } catch (e) {
      const err = e as ParseError
      result.push({
        line: lineNo,
        text,
        stmt: null,
        error: {
          severity: 'error',
          file: fileName,
          line: err.line ?? lineNo,
          column: err.column,
          code: err.code ?? 'JB-SYNTAX',
          message: err.message,
        },
      })
    }
  }
  return result
}
