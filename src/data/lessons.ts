export interface Lesson {
  id: string
  track: 'basics' | 'arrays' | 'control' | 'files' | 'subroutines' | 't24'
  title: string
  objective: string
  starterPath: string
  hints: string[]
  validate: (output: string) => { pass: boolean; message: string }
}

export const LESSONS: Lesson[] = [
  {
    id: 'hello',
    track: 'basics',
    title: '1. Hello World',
    objective: 'Write a PROGRAM that prints HELLO WORLD using CRT.',
    starterPath: 'BP/HELLO.b',
    hints: ['PROGRAM name then statements, end with END', 'CRT "HELLO WORLD"'],
    validate: (out) => ({
      pass: /HELLO WORLD/i.test(out),
      message: /HELLO WORLD/i.test(out) ? 'Pass — CRT works.' : 'Expected output to contain HELLO WORLD',
    }),
  },
  {
    id: 'concat',
    track: 'basics',
    title: '2. Concatenation',
    objective: 'Print Learning JBasic for Temenos Transact using the : operator.',
    starterPath: 'BP/VARS.b',
    hints: ['PRODUCT = "Temenos Transact"', 'CRT "Learning JBasic for ":PRODUCT'],
    validate: (out) => ({
      pass: /Learning JBasic for Temenos Transact/i.test(out),
      message: /Learning JBasic for Temenos Transact/i.test(out)
        ? 'Pass — concatenation works.'
        : 'Expected "Learning JBasic for Temenos Transact"',
    }),
  },
  {
    id: 'add',
    track: 'basics',
    title: '3. Addition',
    objective: 'Add two numbers with + and print A + B = 42.',
    starterPath: 'BP/ADD.b',
    hints: ['RESULT = A + B', '15 + 27 = 42'],
    validate: (out) => ({
      pass: /A \+ B = 42/.test(out),
      message: /A \+ B = 42/.test(out) ? 'Pass — addition works.' : 'Expected A + B = 42',
    }),
  },
  {
    id: 'subtract',
    track: 'basics',
    title: '4. Subtraction',
    objective: 'Subtract with - and print A - B = 32.',
    starterPath: 'BP/SUBTRACT.b',
    hints: ['RESULT = A - B', '50 - 18 = 32'],
    validate: (out) => ({
      pass: /A - B = 32/.test(out),
      message: /A - B = 32/.test(out) ? 'Pass — subtraction works.' : 'Expected A - B = 32',
    }),
  },
  {
    id: 'multiply',
    track: 'basics',
    title: '5. Multiplication',
    objective: 'Multiply with * and print A * B = 96.',
    starterPath: 'BP/MULTIPLY.b',
    hints: ['RESULT = A * B', '12 * 8 = 96'],
    validate: (out) => ({
      pass: /A \* B = 96/.test(out),
      message: /A \* B = 96/.test(out) ? 'Pass — multiplication works.' : 'Expected A * B = 96',
    }),
  },
  {
    id: 'remainder',
    track: 'basics',
    title: '6. Remainder (MOD)',
    objective: 'Use MOD(A, B) so remainder of 17 / 5 prints as 2.',
    starterPath: 'BP/REMAINDER.b',
    hints: ['MOD(A, B) or REM(A, B)', '17 MOD 5 = 2'],
    validate: (out) => ({
      pass: /MOD\(A, B\) = 2/.test(out),
      message: /MOD\(A, B\) = 2/.test(out) ? 'Pass — remainder works.' : 'Expected MOD(A, B) = 2',
    }),
  },
  {
    id: 'arithmetic-all',
    track: 'basics',
    title: '7. All arithmetic ops',
    objective: 'Run ARITHMETIC.b and confirm add/subtract/multiply/remainder lines.',
    starterPath: 'BP/ARITHMETIC.b',
    hints: ['Open BP/ARITHMETIC.b', 'Compile & Run'],
    validate: (out) => ({
      pass: /Add\s*:.*26/.test(out) && /Remainder\s*:.*2/.test(out),
      message:
        /Add\s*:.*26/.test(out) && /Remainder\s*:.*2/.test(out)
          ? 'Pass — full arithmetic demo works.'
          : 'Expected Add ... 26 and Remainder ... 2',
    }),
  },
  {
    id: 'dyn-array',
    track: 'arrays',
    title: '8. Dynamic arrays',
    objective: 'Build a record with FM markers and extract field 1.',
    starterPath: 'BP/DYN.ARRAY.b',
    hints: ['$INSERT I_EQUATE', 'REC<1> extracts field 1'],
    validate: (out) => ({
      pass: /Name\s*:\s*John/i.test(out),
      message: /Name\s*:\s*John/i.test(out) ? 'Pass — extract works.' : 'Expected Name : John in output',
    }),
  },
  {
    id: 'for-loop',
    track: 'control',
    title: '9. FOR / NEXT',
    objective: 'Loop I from 1 to 5 and print each value.',
    starterPath: 'BP/LOOPS.b',
    hints: ['FOR I = 1 TO 5 ... NEXT I'],
    validate: (out) => ({
      pass: /I = 1/.test(out) && /I = 5/.test(out),
      message: /I = 1/.test(out) && /I = 5/.test(out) ? 'Pass — loop works.' : 'Expected I = 1 .. I = 5',
    }),
  },
  {
    id: 'gosub',
    track: 'subroutines',
    title: '10. GOSUB structure',
    objective: 'Use INIT/PROCESS/FINAL labels with GOSUB/RETURN.',
    starterPath: 'BP/GOSUB.DEMO.b',
    hints: ['GOSUB LABEL then LABEL: ... RETURN'],
    validate: (out) => ({
      pass: /Initialised/i.test(out) && /Done/i.test(out),
      message: /Initialised/i.test(out) && /Done/i.test(out) ? 'Pass — GOSUB flow works.' : 'Expected Initialised and Done',
    }),
  },
  {
    id: 'file-io',
    track: 'files',
    title: '11. File OPEN/READ',
    objective: 'Read customer 100001 from F.CUSTOMER and print the name.',
    starterPath: 'BP/FILE.IO.b',
    hints: ['OPEN FN TO F ELSE ... END', 'READ REC FROM F, ID ELSE ...'],
    validate: (out) => ({
      pass: /John/i.test(out),
      message: /John/i.test(out) ? 'Pass — file I/O works.' : 'Expected customer name John in output',
    }),
  },
  {
    id: 't24-sub',
    track: 't24',
    title: '12. T24-style subroutine',
    objective: 'Compile V.AUT.CNT, set ID.NEW, run and show account total.',
    starterPath: 'BP/V.AUT.CNT.b',
    hints: [
      'Compile the subroutine first',
      'Set ID.NEW in the Runtime panel to 100001 before Run',
      'DCOUNT of CUSTOMER.ACCOUNT fields',
    ],
    validate: (out) => ({
      pass: /TOTAL\.ACCOUNTS\s*=\s*2/i.test(out),
      message: /TOTAL\.ACCOUNTS\s*=\s*2/i.test(out)
        ? 'Pass — version-style routine works.'
        : 'Set ID.NEW=100001 then Run — expect TOTAL.ACCOUNTS = 2',
    }),
  },
]
