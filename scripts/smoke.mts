import { compileSource } from '../src/engine/compiler.ts'
import { runUnit } from '../src/engine/runtime.ts'
import { globalVfs } from '../src/engine/vfs.ts'

async function main() {
  globalVfs.seedDemo()
  const samples = [
    'PROGRAM HELLO\n    CRT "HELLO WORLD"\nEND\n',
    'PROGRAM DYN\nEQUATE FM TO CHAR(254)\nREC = "John":FM:"Doha"\nCRT REC<1>\nEND\n',
    `PROGRAM FILEIO
FN.CUS = "F.CUSTOMER"
F.CUS = ""
OPEN FN.CUS TO F.CUS ELSE
    CRT "fail"
    STOP
END
READ R.CUS FROM F.CUS, "100001" ELSE
    CRT "missing"
    STOP
END
CRT R.CUS<1>
END
`,
  ]

  for (const src of samples) {
    const r = compileSource(src, 'BP/TEST.b')
    console.log('--- compile', r.ok, r.errors.map((e) => e.message))
    if (!r.unit) continue
    const out: string[] = []
    const result = await runUnit(r.unit, {
      write: (t, nl) => out.push(t + (nl ? '\n' : '')),
      log: () => {},
      input: async () => '',
      getRoutine: () => null,
    })
    console.log('run', result.ok, JSON.stringify(out.join('')))
  }
}

main()
