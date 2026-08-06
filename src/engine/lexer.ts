export const RESERVED = new Set([
  'ABORT', 'ABS', 'AND', 'BEGIN', 'BREAK', 'CALL', 'CASE', 'CATCH', 'CHAIN', 'CHANGE',
  'CHAR', 'CLEAR', 'CLEARFILE', 'CLOSE', 'COMMON', 'CONTINUE', 'CONVERT', 'COS',
  'COUNT', 'CRT', 'DATA', 'DATE', 'DCOUNT', 'DEBUG', 'DEL', 'DELETE', 'DIM', 'DIMENSION',
  'DO', 'ECHO', 'ELSE', 'END', 'ENTER', 'EQU', 'EQUATE', 'EXECUTE', 'EXIT', 'EXP',
  'EXTRACT', 'FIELD', 'FIND', 'FOR', 'FROM', 'FUNCTION', 'GET', 'GOSUB', 'GOTO', 'GO',
  'IF', 'IN', 'INCLUDE', 'INDEX', 'INPUT', 'INS', 'INSERT', 'INT', 'INTO', 'LEN',
  'LN', 'LOCATE', 'LOCK', 'LOOP', 'MATCH', 'MATCHES', 'MAT', 'MATREAD', 'MATWRITE',
  'MOD', 'NEXT', 'NOT', 'NULL', 'NUM', 'OCONV', 'ICONV', 'ON', 'OPEN', 'OR', 'OTHERWISE',
  'OUT', 'PAGE', 'PERFORM', 'PRECISION', 'PRINT', 'PRINTER', 'PRINTERR', 'PROGRAM',
  'PROCREAD', 'PROCWRITE', 'PROMPT', 'READ', 'READNEXT', 'READU', 'READV', 'RELEASE',
  'REM', 'REMOVE', 'REPEAT', 'REPLACE', 'RETURN', 'RETURNING', 'REWIND', 'RND',
  'ROLLBACK', 'SETTING', 'SIN', 'SLEEP', 'SQUOTE', 'SQRT', 'STOP', 'SUBROUTINE',
  'SWAP', 'SYSTEM', 'TAN', 'THEN', 'TIME', 'TIMEDATE', 'TO', 'TRANS', 'TRIM', 'THEN',
  'UNTIL', 'USING', 'WEOF', 'WHILE', 'WITH', 'WRITE', 'WRITEU', 'WRITEV', 'XTD',
])

export type TokenType =
  | 'IDENT'
  | 'NUMBER'
  | 'STRING'
  | 'OP'
  | 'COLON'
  | 'COMMA'
  | 'SEMI'
  | 'LPAREN'
  | 'RPAREN'
  | 'LT'
  | 'GT'
  | 'LBRACK'
  | 'RBRACK'
  | 'EOL'
  | 'EOF'

export interface Token {
  type: TokenType
  value: string
  line: number
  column: number
}

export function tokenizeLine(line: string, lineNo: number): Token[] {
  const tokens: Token[] = []
  let i = 0
  const s = line

  const peek = () => s[i] ?? ''
  const advance = () => s[i++] ?? ''

  while (i < s.length) {
    const start = i
    const ch = peek()

    if (ch === ' ' || ch === '\t') {
      i++
      continue
    }

    // Full-line or inline comment with *
    if (ch === '*' && (start === 0 || /^\s*$/.test(s.slice(0, start)))) {
      break
    }

    // Rem style comment REM ... (must be the whole word, not a prefix of REMAINDER)
    if ((ch === 'R' || ch === 'r') && s.slice(i, i + 3).toUpperCase() === 'REM') {
      const after = s[i + 3]
      if (after === undefined || /[\s;]/.test(after)) {
        break
      }
    }

    // Inline ; comment (jBC often uses ;* or trailing ;)
    if (ch === ';') {
      // statement separator OR comment start if ;* or trailing comment convention
      const rest = s.slice(i + 1).trimStart()
      if (rest.startsWith('*') || rest === '' || !isLikelyNextStatement(rest)) {
        break
      }
      tokens.push({ type: 'SEMI', value: ';', line: lineNo, column: start + 1 })
      i++
      continue
    }

    if (ch === '"' || ch === "'") {
      const quote = advance()
      let value = ''
      while (i < s.length && peek() !== quote) {
        value += advance()
      }
      if (peek() === quote) advance()
      tokens.push({ type: 'STRING', value, line: lineNo, column: start + 1 })
      continue
    }

    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(s[i + 1] ?? ''))) {
      let value = ''
      while (/[0-9.]/.test(peek())) value += advance()
      tokens.push({ type: 'NUMBER', value, line: lineNo, column: start + 1 })
      continue
    }

    if (/[A-Za-z_@$#.]/.test(ch)) {
      let value = ''
      while (/[A-Za-z0-9_@$#.]/.test(peek())) value += advance()
      tokens.push({ type: 'IDENT', value: value.toUpperCase(), line: lineNo, column: start + 1 })
      continue
    }

    const two = s.slice(i, i + 2)
    if (['EQ', 'NE', 'GT', 'LT', 'GE', 'LE', ':=', '->', '<-'].includes(two.toUpperCase()) && /[^A-Za-z0-9_]/.test(s[i + 2] ?? ' ')) {
      // EQ/NE etc are usually identifiers; handled as IDENT. Skip.
    }

    if (['<=', '>=', '<>', ':=', '+=', '-=', '*=', '/=', '**'].includes(two)) {
      tokens.push({ type: 'OP', value: two, line: lineNo, column: start + 1 })
      i += 2
      continue
    }

    const singles: Record<string, TokenType> = {
      '=': 'OP',
      '+': 'OP',
      '-': 'OP',
      '*': 'OP',
      '/': 'OP',
      '^': 'OP',
      '#': 'OP',
      ':': 'COLON',
      ',': 'COMMA',
      '(': 'LPAREN',
      ')': 'RPAREN',
      '<': 'LT',
      '>': 'GT',
      '[': 'LBRACK',
      ']': 'RBRACK',
    }

    if (ch in singles) {
      tokens.push({ type: singles[ch], value: ch, line: lineNo, column: start + 1 })
      i++
      continue
    }

    // Unknown char — skip but keep going
    i++
  }

  tokens.push({ type: 'EOL', value: '', line: lineNo, column: s.length + 1 })
  return tokens
}

function isLikelyNextStatement(rest: string): boolean {
  const first = rest.split(/\s+/)[0]?.toUpperCase() ?? ''
  return [
    'CRT', 'PRINT', 'IF', 'FOR', 'LOOP', 'GOSUB', 'GOTO', 'GO', 'CALL', 'RETURN',
    'STOP', 'ABORT', 'OPEN', 'READ', 'WRITE', 'DELETE', 'CLOSE', 'NULL', 'INPUT',
    'EXECUTE', 'PERFORM', 'END', 'ELSE', 'WHILE', 'UNTIL', 'REPEAT', 'NEXT',
  ].includes(first) || /^[A-Z_@][A-Z0-9_@.]*\s*=/.test(rest.toUpperCase())
}

export function stripLineComment(raw: string): string {
  let inStr: string | null = null
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (inStr) {
      if (ch === inStr) inStr = null
      continue
    }
    if (ch === '"' || ch === "'") {
      inStr = ch
      continue
    }
    if (ch === '*' && (i === 0 || /\s/.test(raw[i - 1]!))) {
      // only treat as comment if at start or after whitespace at beginning-ish
      const before = raw.slice(0, i).trim()
      if (before === '' || before.endsWith(';')) return raw.slice(0, i)
    }
    if (ch === ';' && raw.slice(i + 1).trimStart().startsWith('*')) {
      return raw.slice(0, i)
    }
  }
  return raw
}
