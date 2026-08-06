export interface SampleFile {
  path: string
  content: string
}

export const SAMPLE_FILES: SampleFile[] = [
  {
    path: 'BP/HELLO.b',
    content: `* Simple Hello World — start here
PROGRAM HELLO
    CRT "HELLO WORLD"
END
`,
  },
  {
    path: 'BP/VARS.b',
    content: `* Variables, concatenation and arithmetic
PROGRAM VARS
    NAME = "Ooredoo"
    A = 10
    B = 25
    CRT "Welcome to ":NAME
    CRT "Sum = ":(A + B)
    CRT "Product = ":(A * B)
END
`,
  },
  {
    path: 'BP/ADD.b',
    content: `* Addition example — A + B
PROGRAM ADD
    A = 15
    B = 27
    RESULT = A + B
    CRT "A = ":A
    CRT "B = ":B
    CRT "A + B = ":RESULT
END
`,
  },
  {
    path: 'BP/SUBTRACT.b',
    content: `* Subtraction example — A - B
PROGRAM SUBTRACT
    A = 50
    B = 18
    RESULT = A - B
    CRT "A = ":A
    CRT "B = ":B
    CRT "A - B = ":RESULT
END
`,
  },
  {
    path: 'BP/MULTIPLY.b',
    content: `* Multiplication example — A * B
PROGRAM MULTIPLY
    A = 12
    B = 8
    RESULT = A * B
    CRT "A = ":A
    CRT "B = ":B
    CRT "A * B = ":RESULT
END
`,
  },
  {
    path: 'BP/REMAINDER.b',
    content: `* Remainder / modulus examples — MOD and REM
* Remainder is what is left after division (e.g. 17 / 5 = 3 remainder 2)
PROGRAM REMAINDER
    A = 17
    B = 5
    R1 = MOD(A, B)
    R2 = REM(A, B)
    CRT "A = ":A
    CRT "B = ":B
    CRT "MOD(A, B) = ":R1
    CRT "REM(A, B) = ":R2
    CRT "Check: ":(B * INT(A / B) + R1):" should equal A"
END
`,
  },
  {
    path: 'BP/ARITHMETIC.b',
    content: `* All four operations in one program
PROGRAM ARITHMETIC
    A = 20
    B = 6
    CRT "===== Arithmetic Demo ====="
    CRT "A = ":A:"   B = ":B
    CRT "Add       : ":A:" + ":B:" = ":(A + B)
    CRT "Subtract  : ":A:" - ":B:" = ":(A - B)
    CRT "Multiply  : ":A:" * ":B:" = ":(A * B)
    CRT "Divide    : ":A:" / ":B:" = ":(A / B)
    CRT "Remainder : MOD(":A:", ":B:") = ":MOD(A, B)
    CRT "==========================="
END
`,
  },
  {
    path: 'BP/DYN.ARRAY.b',
    content: `* Dynamic arrays using FM / VM / SM
PROGRAM DYN.ARRAY
    $INSERT I_EQUATE
    REC = "John":FM:"Doha":FM:"ACTIVE"
    REC<3> = "VIP"
    REC<4,1> = "ACC1"
    REC<4,2> = "ACC2"
    CRT "Name  : ":REC<1>
    CRT "City  : ":REC<2>
    CRT "Status: ":REC<3>
    CRT "Acc1  : ":REC<4,1>
    CRT "Acc2  : ":REC<4,2>
    CRT "Fields: ":DCOUNT(REC, FM)
END
`,
  },
  {
    path: 'BP/LOOPS.b',
    content: `* FOR/NEXT and LOOP/WHILE/REPEAT
PROGRAM LOOPS
    CRT "FOR loop:"
    FOR I = 1 TO 5
        CRT "  I = ":I
    NEXT I

    CRT "WHILE loop:"
    N = 1
    LOOP
    WHILE N <= 3 DO
        CRT "  N = ":N
        N = N + 1
    REPEAT
END
`,
  },
  {
    path: 'BP/GOSUB.DEMO.b',
    content: `* GOSUB / RETURN structured style
PROGRAM GOSUB.DEMO
    GOSUB INIT
    GOSUB PROCESS
    GOSUB FINAL
    STOP

INIT:
    MSG = "Initialised"
    CRT MSG
    RETURN

PROCESS:
    FOR I = 1 TO 3
        CRT "Process step ":I
    NEXT I
    RETURN

FINAL:
    CRT "Done"
    RETURN
END
`,
  },
  {
    path: 'BP/FILE.IO.b',
    content: `* OPEN / READ / WRITE against simulated F.CUSTOMER
PROGRAM FILE.IO
    $INSERT I_EQUATE
    FN.CUS = "F.CUSTOMER"
    F.CUS = ""
    OPEN FN.CUS TO F.CUS ELSE
        CRT "Unable to open ":FN.CUS
        STOP 201, FN.CUS
    END

    Y.ID = "100001"
    READ R.CUS FROM F.CUS, Y.ID ELSE
        CRT "Record ":Y.ID:" not found"
        STOP
    END

    CRT "Customer: ":R.CUS<1>
    CRT "City    : ":R.CUS<2>
    CRT "Status  : ":R.CUS<3>

    R.CUS<3> = "REVIEW"
    WRITE R.CUS ON F.CUS, Y.ID
    CRT "Updated status to REVIEW"
    CLOSE F.CUS
END
`,
  },
  {
    path: 'BP/V.AUT.CNT.b',
    content: `* T24-style version auto-content subroutine (simplified)
SUBROUTINE V.AUT.CNT
    $INSERT I_COMMON
    $INSERT I_EQUATE

    GOSUB INIT
    GOSUB PROCESS
    RETURN

INIT:
    FN.CUS.ACC = "F.CUSTOMER.ACCOUNT"
    F.CUS.ACC = ""
    OPEN FN.CUS.ACC TO F.CUS.ACC ELSE
        ETEXT = "Unable to open CUSTOMER.ACCOUNT"
        RETURN
    END
    RETURN

PROCESS:
    Y.CUS.ID = ID.NEW
    IF Y.CUS.ID EQ "" THEN
        TOTAL = 0
    END ELSE
        READ R.CA FROM F.CUS.ACC, Y.CUS.ID ELSE
            R.CA = ""
        END
        IF R.CA EQ "" THEN
            TOTAL = 0
        END ELSE
            TOTAL = DCOUNT(R.CA, FM)
        END
    END
    CRT "TOTAL.ACCOUNTS = ":TOTAL
    RETURN
END
`,
  },
  {
    path: 'BP/ERRORS.DEMO.b',
    content: `* Intentionally broken — click Compile to see TAFJ-style errors
PROGRAM ERRORS.DEMO
    CRT = 10
    IF A = 1
        CRT "missing END for IF"
    FOR I = 1 TO 3
        CRT I
END
`,
  },
]

export const DEFAULT_OPEN = 'BP/HELLO.b'
