import { compileSource } from '../src/engine/compiler.ts'
import { runUnit } from '../src/engine/runtime.ts'
import { globalVfs } from '../src/engine/vfs.ts'
import { JBC1_DOCS } from '../src/data/jbc1Docs.ts'
import { SAMPLE_FILES } from '../src/data/samples.ts'
import { LESSONS } from '../src/data/lessons.ts'

async function run(source: string, path = 'BP/T.b') {
  globalVfs.loadSnapshot({})
  globalVfs.seedDemo()
  const compiled = compileSource(source, path)
  if (!compiled.unit) {
    return { ok: false, out: '', errors: compiled.errors.map((e) => `${e.line}: ${e.message}`) }
  }
  const out: string[] = []
  let pending = ''
  const registry: Record<string, NonNullable<typeof compiled.unit>> = {
    [compiled.unit.name]: compiled.unit,
  }
  // Preload sample subroutines for CALL demos
  for (const f of SAMPLE_FILES) {
    const c = compileSource(f.content, f.path)
    if (c.unit) registry[c.unit.name] = c.unit
  }
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
    input: async () => 'Learner',
    getRoutine: (n) => registry[n] ?? null,
  })
  if (pending) out.push(pending)
  return { ok: res.ok, out: out.join('\n'), errors: res.error ? [res.error.message] : [] }
}

let failures = 0

console.log('--- Runnable JBC1 examples ---')
const seen = new Set<string>()
for (const doc of JBC1_DOCS.filter((d) => d.supported && d.example)) {
  if (seen.has(doc.example!)) continue
  seen.add(doc.example!)
  const r = await run(doc.example!, `BP/DEMO.${doc.name}.b`)
  // Some demos intentionally stop/abort
  const fatalCompile = r.errors.some((e) => !/abort|stop/i.test(e))
  if (!r.ok && fatalCompile && !/ABORT|STOP|SLEEP/i.test(doc.name)) {
    // STOP/ABORT demos may report stopped
  }
  if (!r.ok && r.errors.length && !/ABORT|Something went wrong|STOP/i.test(r.out + r.errors.join(' '))) {
    // allow STOP/ABORT style
    if (!doc.example!.includes('ABORT') && !doc.example!.includes('STOP\n') && !doc.example!.includes('STOP\r')) {
      failures++
      console.log(`FAIL ${doc.name}:`, r.errors, JSON.stringify(r.out))
      continue
    }
  }
  console.log(`ok   ${doc.name}`)
}

console.log('\n--- Samples ---')
for (const f of SAMPLE_FILES) {
  if (f.path.includes('ERRORS')) {
    const c = compileSource(f.content, f.path)
    console.log(c.ok ? `FAIL ${f.path} should fail` : `ok   ${f.path} (expected compile fail)`)
    if (c.ok) failures++
    continue
  }
  const r = await run(f.content, f.path)
  if (!r.ok) {
    failures++
    console.log(`FAIL ${f.path}`, r.errors)
  } else {
    console.log(`ok   ${f.path}`)
  }
}

console.log('\n--- Lessons ---')
for (const lesson of LESSONS) {
  const file = SAMPLE_FILES.find((f) => f.path === lesson.starterPath)
  if (!file) {
    failures++
    console.log(`FAIL missing ${lesson.starterPath}`)
    continue
  }
  const r = await run(file.content, file.path)
  const v = lesson.validate(r.out)
  if (!v.pass) {
    failures++
    console.log(`FAIL ${lesson.id}: ${v.message} :: ${JSON.stringify(r.out)}`)
  } else console.log(`ok   ${lesson.id}`)
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
