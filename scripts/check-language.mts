import { compileSource } from '../src/engine/compiler.ts'
import { runUnit } from '../src/engine/runtime.ts'
import { globalVfs } from '../src/engine/vfs.ts'
import { SAMPLE_FILES } from '../src/data/samples.ts'
import { LESSONS } from '../src/data/lessons.ts'

async function run(source: string, path = 'BP/T.b') {
  globalVfs.loadSnapshot({})
  globalVfs.seedDemo()
  const compiled = compileSource(source, path)
  if (!compiled.unit) return { ok: false, out: '', errors: compiled.errors.map((e) => `${e.line}: ${e.message}`) }
  const out: string[] = []
  let pending = ''
  const registry: Record<string, NonNullable<typeof compiled.unit>> = { [compiled.unit.name]: compiled.unit }
  let target = compiled.unit
  if (compiled.unit.type === 'SUBROUTINE') {
    const wrap = compileSource(
      `PROGRAM RUN.X\n$INSERT I_COMMON\nID.NEW = "100001"\nCALL ${compiled.unit.name}\nEND\n`,
      'BP/RUN.X.b',
    )
    if (wrap.unit) target = wrap.unit
  }
  const res = await runUnit(target, {
    write: (t, nl) => {
      pending += t
      if (nl) {
        out.push(pending)
        pending = ''
      }
    },
    log: () => {},
    input: async () => '',
    getRoutine: (n) => registry[n] ?? null,
  })
  if (pending !== '') out.push(pending)
  return { ok: res.ok, out: out.join('\n'), errors: res.error ? [res.error.message] : [] }
}

const cases: Array<{ name: string; src: string; expect: string }> = [
  {
    name: 'less-than comparison',
    src: `PROGRAM T\nA = 3\nB = 9\nIF A < B THEN\n CRT "A is smaller"\nEND\nEND\n`,
    expect: 'A is smaller',
  },
  {
    name: 'greater-than comparison',
    src: `PROGRAM T\nA = 10\nIF A > 5 THEN\n CRT "big"\nEND ELSE\n CRT "small"\nEND\nEND\n`,
    expect: 'big',
  },
  {
    name: 'else branch',
    src: `PROGRAM T\nA = 1\nIF A > 5 THEN\n CRT "big"\nEND ELSE\n CRT "small"\nEND\nEND\n`,
    expect: 'small',
  },
  {
    name: 'GE / LE keywords',
    src: `PROGRAM T\nIF 5 GE 5 THEN CRT "ge ok"\nEND\nIF 4 LE 5 THEN CRT "le ok"\nEND\nEND\n`,
    expect: 'ge ok\nle ok',
  },
  {
    name: 'trailing colon suppresses newline',
    src: `PROGRAM T\nCRT "AB":\nCRT "CD"\nEND\n`,
    expect: 'ABCD',
  },
  {
    name: 'operator precedence',
    src: `PROGRAM T\nCRT 2 + 3 * 4\nCRT (2 + 3) * 4\nEND\n`,
    expect: '14\n20',
  },
  {
    name: 'division precision',
    src: `PROGRAM T\nCRT 20 / 6\nEND\n`,
    expect: '3.3333',
  },
  {
    name: 'negative numbers',
    src: `PROGRAM T\nA = 5\nCRT A - 12\nCRT -A\nEND\n`,
    expect: '-7\n-5',
  },
  {
    name: 'LOOP UNTIL',
    src: `PROGRAM T\nN = 1\nLOOP\nUNTIL N > 3 DO\n CRT N\n N = N + 1\nREPEAT\nEND\n`,
    expect: '1\n2\n3',
  },
  {
    name: 'FOR STEP',
    src: `PROGRAM T\nFOR I = 10 TO 1 STEP -5\n CRT I\nNEXT I\nEND\n`,
    expect: '10\n5',
  },
  {
    name: 'AND / OR',
    src: `PROGRAM T\nA = 5\nIF A > 1 AND A < 10 THEN CRT "in range"\nEND\nEND\n`,
    expect: 'in range',
  },
  {
    name: 'string functions',
    src: `PROGRAM T\nS = "Temenos"\nCRT LEN(S)\nCRT UPCASE(S)\nCRT S[1,3]\nEND\n`,
    expect: '7\nTEMENOS\nTem',
  },
  {
    name: 'CALL subroutine with args',
    src: `SUBROUTINE ADDER(X, Y)\nCRT "sum=":(X + Y)\nRETURN\nEND\n`,
    expect: '',
  },
]

/** Programs that must be rejected by the compiler. */
const badCases: Array<{ name: string; src: string; expectLine: number }> = [
  {
    name: 'garbage characters on a line',
    src: `PROGRAM T\nCRT "TODO"\njj*&^^^^**YYY\nEND\n`,
    expectLine: 3,
  },
  {
    name: 'unknown character',
    src: `PROGRAM T\nA = 1 & 2\nEND\n`,
    expectLine: 2,
  },
  {
    name: 'two statements without separator',
    src: `PROGRAM T\nA = 1 B = 2\nEND\n`,
    expectLine: 2,
  },
  {
    name: 'trailing junk after CRT',
    src: `PROGRAM T\nCRT "hi" ]]\nEND\n`,
    expectLine: 2,
  },
  {
    name: 'NEXT variable does not match FOR',
    src: `PROGRAM T\nFOR I = 1 TO 3\nCRT I\nNEXT J\nEND\n`,
    expectLine: 4,
  },
  {
    name: 'bare variable is not a statement',
    src: `PROGRAM T\nsewewrrr\nCRT "HELLO"\nEND\n`,
    expectLine: 2,
  },
  {
    name: 'misspelled keyword',
    src: `PROGRAM T\nCRTT "hi"\nEND\n`,
    expectLine: 2,
  },
  {
    name: 'bare literal is not a statement',
    src: `PROGRAM T\n42\nEND\n`,
    expectLine: 2,
  },
]

let failures = 0

for (const c of badCases) {
  const r = compileSource(c.src, 'BP/T.b')
  const hit = r.errors.find((e) => e.line === c.expectLine)
  if (r.ok || !hit) {
    failures++
    console.log(`FAIL ${c.name}: expected an error on line ${c.expectLine}`)
    console.log('  errors  :', JSON.stringify(r.errors))
  } else {
    console.log(`ok   ${c.name} -> ${hit.message}`)
  }
}

for (const c of cases) {
  const r = await run(c.src)
  const actual = r.out.trim()
  const pass = c.expect === '' ? r.ok : actual === c.expect
  if (!pass) {
    failures++
    console.log(`FAIL ${c.name}`)
    console.log('  expected:', JSON.stringify(c.expect))
    console.log('  actual  :', JSON.stringify(actual))
    if (r.errors.length) console.log('  errors  :', r.errors)
  } else {
    console.log(`ok   ${c.name}`)
  }
}

console.log('\n--- Lesson validators against their starter files ---')
for (const lesson of LESSONS) {
  const file = SAMPLE_FILES.find((f) => f.path === lesson.starterPath)
  if (!file) {
    failures++
    console.log(`FAIL ${lesson.id}: starter file missing (${lesson.starterPath})`)
    continue
  }
  const r = await run(file.content, file.path)
  const verdict = lesson.validate(r.out)
  if (!verdict.pass) {
    failures++
    console.log(`FAIL ${lesson.id}: ${verdict.message}`)
  } else {
    console.log(`ok   ${lesson.id}`)
  }
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
