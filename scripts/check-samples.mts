import { compileSource } from '../src/engine/compiler.ts'
import { runUnit } from '../src/engine/runtime.ts'
import { globalVfs } from '../src/engine/vfs.ts'
import { SAMPLE_FILES } from '../src/data/samples.ts'

async function runOne(path: string, source: string) {
  globalVfs.loadSnapshot({})
  globalVfs.seedDemo()

  const compiled = compileSource(source, path)
  const out: string[] = []

  if (!compiled.unit) {
    return { path, compileOk: compiled.ok, errors: compiled.errors, output: '' }
  }

  let target = compiled.unit
  const registry: Record<string, typeof compiled.unit> = { [compiled.unit.name]: compiled.unit }

  if (compiled.unit.type === 'SUBROUTINE') {
    const wrap = compileSource(
      `PROGRAM RUN.${compiled.unit.name}\n$INSERT I_COMMON\nID.NEW = "100001"\nCALL ${compiled.unit.name}\nEND\n`,
      `BP/RUN.${compiled.unit.name}.b`,
    )
    if (wrap.unit) target = wrap.unit
  }

  const result = await runUnit(target, {
    write: (text, newline) => {
      if (!newline && out.length) out[out.length - 1] += text
      else out.push(text)
    },
    log: () => {},
    input: async () => '',
    getRoutine: (name) => registry[name] ?? null,
  })

  return { path, compileOk: compiled.ok, errors: compiled.errors, runOk: result.ok, runError: result.error, output: out.join('\n') }
}

for (const file of SAMPLE_FILES) {
  const r = await runOne(file.path, file.content)
  console.log('='.repeat(60))
  console.log(r.path, '| compile:', r.compileOk, '| run:', r.runOk)
  if (r.errors.length) console.log('COMPILE ERRORS:', r.errors.map((e) => `${e.line}: ${e.message}`))
  if (r.runError) console.log('RUN ERROR:', r.runError.message)
  console.log(r.output)
}
