import { useIdeStore } from '../store/useIdeStore'

export function Toolbar() {
  const compile = useIdeStore((s) => s.compile)
  const run = useIdeStore((s) => s.run)
  const compileAndRun = useIdeStore((s) => s.compileAndRun)
  const busy = useIdeStore((s) => s.busy)
  const clearTerminal = useIdeStore((s) => s.clearTerminal)
  const idNew = useIdeStore((s) => s.idNew)
  const setIdNew = useIdeStore((s) => s.setIdNew)
  const inputBuffer = useIdeStore((s) => s.inputBuffer)
  const setInputBuffer = useIdeStore((s) => s.setInputBuffer)
  const resetVfs = useIdeStore((s) => s.resetVfs)

  return (
    <header className="toolbar">
      <div className="brand">
        <span className="brand-mark">JB Simulator</span>
        <span className="brand-sub">JBasic · TAFJ learning lab</span>
      </div>
      <div className="toolbar-actions">
        <button className="btn" onClick={compile} disabled={busy}>
          Compile
        </button>
        <button className="btn" onClick={() => void run()} disabled={busy}>
          Run
        </button>
        <button className="btn btn-primary" onClick={() => void compileAndRun()} disabled={busy}>
          Compile & Run
        </button>
        <button className="btn" onClick={clearTerminal}>
          Clear logs
        </button>
        <button className="btn" onClick={resetVfs}>
          Reset VFS
        </button>
      </div>
      <div className="runtime-fields">
        <label>
          ID.NEW
          <input value={idNew} onChange={(e) => setIdNew(e.target.value)} title="Used when running SUBROUTINE" />
        </label>
        <label>
          INPUT queue
          <input
            value={inputBuffer}
            onChange={(e) => setInputBuffer(e.target.value)}
            placeholder="line1\\nline2"
            style={{ width: 140 }}
            title="Values fed to INPUT statements"
          />
        </label>
      </div>
    </header>
  )
}
