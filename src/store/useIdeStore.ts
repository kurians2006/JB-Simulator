import { create } from 'zustand'
import { compileSource } from '../engine/compiler'
import { runUnit } from '../engine/runtime'
import { globalVfs } from '../engine/vfs'
import type { CompileError, CompileLogLine, CompiledUnit } from '../engine/types'
import { DEFAULT_OPEN, SAMPLE_FILES } from '../data/samples'
import { LESSONS, type Lesson } from '../data/lessons'

export interface IdeFile {
  path: string
  content: string
}

interface IdeState {
  files: Record<string, string>
  openPath: string
  compiled: Record<string, CompiledUnit>
  compileLogs: CompileLogLine[]
  terminalLines: string[]
  errors: CompileError[]
  status: string
  busy: boolean
  activeLessonId: string | null
  lessonMessage: string
  idNew: string
  inputBuffer: string
  rightTab: 'terminal' | 'errors' | 'lessons' | 'vfs'
  setOpenPath: (path: string) => void
  setContent: (content: string) => void
  createFile: (path: string) => void
  deleteFile: (path: string) => void
  setRightTab: (tab: IdeState['rightTab']) => void
  setIdNew: (v: string) => void
  setInputBuffer: (v: string) => void
  clearTerminal: () => void
  compile: () => void
  run: () => Promise<void>
  compileAndRun: () => Promise<void>
  selectLesson: (id: string) => void
  resetVfs: () => void
}

function initialFiles(): Record<string, string> {
  const files: Record<string, string> = {}
  for (const f of SAMPLE_FILES) files[f.path] = f.content
  return files
}

globalVfs.seedDemo()

export const useIdeStore = create<IdeState>((set, get) => ({
  files: initialFiles(),
  openPath: DEFAULT_OPEN,
  compiled: {},
  compileLogs: [],
  terminalLines: [
    'JB Simulator — JBasic / InfoBASIC learning lab (TAFJ-style compile flow)',
    'Tip: Compile then Run. Open Lessons for a guided path.',
    '',
  ],
  errors: [],
  status: 'Ready',
  busy: false,
  activeLessonId: 'hello',
  lessonMessage: '',
  idNew: '100001',
  inputBuffer: '',
  rightTab: 'terminal',

  setOpenPath: (path) => set({ openPath: path, status: `Opened ${path}` }),

  setContent: (content) => {
    const { openPath, files } = get()
    set({ files: { ...files, [openPath]: content } })
  },

  createFile: (path) => {
    const normalized = path.endsWith('.b') ? path : `${path}.b`
    const full = normalized.includes('/') ? normalized : `BP/${normalized}`
    const { files } = get()
    if (files[full]) {
      set({ openPath: full, status: 'File already exists' })
      return
    }
    const name = full.split('/').pop()!.replace(/\.b$/i, '').toUpperCase()
    const content = `* ${name}\nPROGRAM ${name}\n    CRT "TODO"\nEND\n`
    set({
      files: { ...files, [full]: content },
      openPath: full,
      status: `Created ${full}`,
    })
  },

  deleteFile: (path) => {
    const { files, openPath } = get()
    const next = { ...files }
    delete next[path]
    const keys = Object.keys(next)
    set({
      files: next,
      openPath: openPath === path ? keys[0] ?? '' : openPath,
      status: `Deleted ${path}`,
    })
  },

  setRightTab: (rightTab) => set({ rightTab }),
  setIdNew: (idNew) => set({ idNew }),
  setInputBuffer: (inputBuffer) => set({ inputBuffer }),
  clearTerminal: () => set({ terminalLines: [] }),

  compile: () => {
    const { openPath, files, compiled } = get()
    const source = files[openPath] ?? ''
    const result = compileSource(source, openPath)
    const nextCompiled = { ...compiled }
    if (result.unit) {
      nextCompiled[result.unit.name] = result.unit
      nextCompiled[openPath] = result.unit
    }
    set({
      compiled: nextCompiled,
      compileLogs: result.logs,
      errors: result.errors,
      terminalLines: [
        ...get().terminalLines,
        ...result.logs.map((l) => `[${l.level}] ${l.text}`),
        '',
      ],
      status: result.ok ? `Compiled ${result.programName}` : `Compile failed (${result.errors.length})`,
      rightTab: result.ok ? 'terminal' : 'errors',
    })
  },

  run: async () => {
    const state = get()
    if (state.busy) return
    const unit =
      state.compiled[state.openPath] ||
      Object.values(state.compiled).find((u) => u.fileName === state.openPath)

    if (!unit) {
      set({
        status: 'Not compiled — compile first',
        terminalLines: [...state.terminalLines, '[ERROR] No compiled unit. Click Compile first.', ''],
        rightTab: 'terminal',
      })
      return
    }

    set({ busy: true, status: `Running ${unit.name}...`, rightTab: 'terminal' })

    // Inject ID.NEW for T24-style routines
    const sourceWithCommon = unit
    const inputs = state.inputBuffer
      .split(/\n/)
      .map((s) => s.trimEnd())
      .filter((s, i, arr) => s.length > 0 || i < arr.length - 1)

    const writeLines: string[] = []
    const hooks = {
      write: (text: string, newline: boolean) => {
        writeLines.push(newline ? text : text)
        // merge suppress-nl by mutating last — simplified: always push
        set((s) => {
          const lines = [...s.terminalLines]
          if (!newline && lines.length) {
            lines[lines.length - 1] = (lines[lines.length - 1] ?? '') + text
          } else {
            lines.push(text)
          }
          return { terminalLines: lines }
        })
      },
      log: (level: CompileLogLine['level'], text: string) => {
        set((s) => ({ terminalLines: [...s.terminalLines, `[${level}] ${text}`] }))
      },
      input: async () => {
        if (inputs.length) return inputs.shift() ?? ''
        return ''
      },
      getRoutine: (name: string) => {
        const { compiled } = get()
        return compiled[name] ?? compiled[`${name}.b`] ?? null
      },
    }

    // Patch common ID.NEW via a tiny prelude run — set on interpreter through CALL shared common.
    // We monkey-patch by wrapping: compile a launcher if subroutine
    let runTarget = sourceWithCommon
    if (unit.type === 'SUBROUTINE') {
      // Ensure ID.NEW available: create ephemeral wrapper unit
      const wrapSource = `
PROGRAM RUN.${unit.name}
    $INSERT I_COMMON
    ID.NEW = "${state.idNew.replace(/"/g, '')}"
    CALL ${unit.name}
END
`
      const wrap = compileSource(wrapSource, `BP/RUN.${unit.name}.b`)
      if (wrap.unit) {
        // ensure subroutine is visible
        get().compiled[unit.name] = unit
        runTarget = wrap.unit
      }
    }

    set((s) => ({
      terminalLines: [...s.terminalLines, `---- RUN ${runTarget.name} ----`],
    }))

    const result = await runUnit(runTarget, hooks, inputs)

    let lessonMessage = ''
    const lesson = LESSONS.find((l) => l.id === get().activeLessonId)
    if (lesson) {
      const out = writeLines.join('\n')
      const v = lesson.validate(out)
      lessonMessage = v.message
    }

    set((s) => ({
      busy: false,
      status: result.ok
        ? `Finished ${runTarget.name} (${result.elapsedMs.toFixed(1)} ms)`
        : `Runtime error in ${runTarget.name}`,
      errors: result.error ? [...s.errors, result.error] : s.errors,
      terminalLines: [
        ...s.terminalLines,
        result.ok ? `[INFO] Exit code ${result.exitCode}` : `[ERROR] ${result.error?.message ?? 'failed'}`,
        '',
      ],
      lessonMessage,
      rightTab: result.error ? 'errors' : s.rightTab,
    }))
  },

  compileAndRun: async () => {
    get().compile()
    const { errors } = get()
    if (errors.length === 0) await get().run()
  },

  selectLesson: (id) => {
    const lesson = LESSONS.find((l) => l.id === id) as Lesson | undefined
    if (!lesson) return
    set({
      activeLessonId: id,
      openPath: lesson.starterPath,
      rightTab: 'lessons',
      lessonMessage: '',
      status: `Lesson: ${lesson.title}`,
    })
  },

  resetVfs: () => {
    globalVfs.loadSnapshot({})
    globalVfs.seedDemo()
    set({ status: 'VFS reset to demo data' })
  },
}))
