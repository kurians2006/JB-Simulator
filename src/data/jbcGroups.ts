import { JBC1_DOCS, findJbcDoc, type JbcDocEntry } from './jbc1Docs'

export interface DocGroup {
  id: string
  title: string
  blurb: string
  /** Match by primary keyword (name before / or space). */
  members: string[]
}

/**
 * Relative learning groups so newcomers are not dumped into one long A–Z list.
 * Unsupported topics stay visible inside their group.
 */
export const DOC_GROUPS: DocGroup[] = [
  {
    id: 'start',
    title: '1. Getting started',
    blurb: 'How a jBC program is shaped and how you print output.',
    members: ['PROGRAM', 'SUBROUTINE', 'END', 'CRT', 'PRINT', 'DISPLAY', 'NULL', '@'],
  },
  {
    id: 'vars',
    title: '2. Variables & constants',
    blurb: 'Storing values, naming constants, and sharing data.',
    members: ['EQUATE', 'COMMON', 'CLEAR', 'CLEARCOMMON', 'ASSIGNED', 'UNASSIGNED', 'DIMENSION', 'MAT'],
  },
  {
    id: 'math',
    title: '3. Numbers & math',
    blurb: 'Arithmetic helpers used every day in Transact routines.',
    members: [
      'ABS', 'INT', 'MOD', 'REM', 'NEG', 'NOT', 'NUM', 'RND', 'SQRT', 'EXP', 'LN', 'PWR',
      'SIN', 'COS', 'TAN', 'PRECISION', 'DIV', 'FADD', 'FSUB', 'FMUL', 'FDIV',
    ],
  },
  {
    id: 'text',
    title: '4. Text & strings',
    blurb: 'Cutting, cleaning, searching, and formatting text.',
    members: [
      'LEN', 'LEFT', 'RIGHT', 'TRIM', 'TRIMF', 'TRIMB', 'UPCASE', 'DOWNCASE', 'LOWCASE',
      'FIELD', 'INDEX', 'COUNT', 'DCOUNT', 'CHANGE', 'CONVERT', 'SWAP', 'STR', 'SPACE',
      'FMT', 'CHAR', 'SEQ', 'ALPHA', 'QUOTE', 'DQUOTE', 'SQUOTE', 'MATCHES', 'EREPLACE',
      'GROUP', 'INSERT', 'EXTRACT', 'REPLACE',
    ],
  },
  {
    id: 'decide',
    title: '5. Decisions',
    blurb: 'Choose different paths with IF and CASE.',
    members: ['IF', 'CASE', 'BEGIN'],
  },
  {
    id: 'loops',
    title: '6. Loops',
    blurb: 'Repeat work with FOR/NEXT and LOOP/WHILE/UNTIL.',
    members: ['FOR', 'LOOP', 'BREAK', 'CONTINUE'],
  },
  {
    id: 'subs',
    title: '7. Subroutines & calls',
    blurb: 'Organise code with GOSUB, CALL, RETURN.',
    members: ['GOSUB', 'GOTO', 'ONGOSUB/ONGOTO', 'CALL', 'RETURN', 'ENTER', 'CHAIN', 'FUNCTION', 'DEFFUN'],
  },
  {
    id: 'arrays',
    title: '8. Dynamic arrays',
    blurb: 'FM/VM/SM records — the heart of Transact data.',
    members: [
      'DEL', 'INS', 'FIND', 'FINDSTR', 'LOCATE', 'LOWER', 'RAISE', 'REMOVE', 'SUM',
      'SORT', 'MAXIMUM', 'MINIMUM', 'ADDS', 'SUBS', 'MULS', 'DIVS', 'CATS', 'COUNTS',
    ],
  },
  {
    id: 'files',
    title: '9. Files & records',
    blurb: 'OPEN / READ / WRITE — talking to database files.',
    members: [
      'OPEN', 'OPENPATH', 'OPENSEQ', 'READ', 'READU', 'READV', 'WRITE', 'WRITEU', 'WRITEV',
      'DELETE', 'DELETEU', 'CLOSE', 'CLOSESEQ', 'CLEARFILE', 'SELECT', 'READNEXT',
      'MATREAD', 'MATWRITE', 'FILELOCK', 'RELEASE', 'STATUS', 'TRANS', 'XLATE',
    ],
  },
  {
    id: 'datetime',
    title: '10. Dates & times',
    blurb: 'Internal Pick dates/times and conversions.',
    members: ['DATE', 'TIME', 'TIMEDATE', 'OCONV', 'ICONV', 'OCONVS', 'ICONVS', 'TIMESTAMP', 'TIMEDIFF', 'SLEEP', 'MSLEEP'],
  },
  {
    id: 'input',
    title: '11. User input',
    blurb: 'Reading values typed by a user or stacked with DATA.',
    members: ['INPUT', 'INPUTNULL', 'INPUTCLEAR', 'PROMPT', 'DATA', 'CLEARDATA', 'KEYIN', 'IN', 'ECHO', 'HUSH'],
  },
  {
    id: 'system',
    title: '12. System & commands',
    blurb: 'Runtime info and launching other commands.',
    members: [
      'SYSTEM', 'EXECUTE', 'PERFORM', 'STOP', 'ABORT', 'EXIT', 'DEBUG', 'GETENV', 'PUTENV',
      'SENTENCE', 'PRINTERR', 'FOOTING', 'HEADING', 'PAGE', 'PRINTER',
    ],
  },
  {
    id: 'advanced',
    title: '13. Advanced / platform',
    blurb: 'Threads, XML, tape, OS files, transactions — learn the names; full jBASE/TAFJ needed to run most of these.',
    members: [], // filled dynamically with leftovers
  },
]

/** Ordered Newcomer Path — walk these topics one by one. */
export const NEWCOMER_PATH: string[] = [
  'PROGRAM',
  'CRT',
  'EQUATE',
  'IF',
  'FOR',
  'LOOP',
  'CASE',
  'LEN',
  'FIELD',
  'TRIM',
  'LEFT',
  'UPCASE',
  'ABS',
  'MOD',
  'DATE',
  'OCONV',
  'GOSUB',
  'RETURN',
  'OPEN',
  'READ',
  'WRITE',
  'DCOUNT',
  'CHAR',
  'CALL',
  'SUBROUTINE',
  'COMMON',
  'INPUT',
  'STOP',
]

function primaryKey(name: string): string {
  return name.toUpperCase().split('/')[0]!.trim().split(/\s+/)[0]!
}

function buildMembership(): Map<string, string> {
  const map = new Map<string, string>()
  for (const group of DOC_GROUPS) {
    if (group.id === 'advanced') continue
    for (const member of group.members) {
      map.set(member.toUpperCase(), group.id)
    }
  }
  return map
}

const MEMBERSHIP = buildMembership()

export function groupIdForDoc(doc: JbcDocEntry): string {
  const key = primaryKey(doc.name)
  // BEGIN CASE lives with decisions
  if (key === 'BEGIN') return 'decide'
  // INCLUDE shares INSERT group conceptually → text/shared code
  if (key === 'INCLUDE') return 'text'
  return MEMBERSHIP.get(key) ?? 'advanced'
}

export function docsInGroup(groupId: string): JbcDocEntry[] {
  return JBC1_DOCS.filter((d) => groupIdForDoc(d) === groupId)
}

export function getNewcomerSteps(): JbcDocEntry[] {
  const steps: JbcDocEntry[] = []
  for (const name of NEWCOMER_PATH) {
    const doc = findJbcDoc(name)
    if (doc) steps.push(doc)
  }
  return steps
}

export function findDocIndex(docs: JbcDocEntry[], doc: JbcDocEntry | null): number {
  if (!doc) return -1
  return docs.findIndex((d) => d.name === doc.name && d.summary === doc.summary)
}
