import { useEffect, useRef } from 'react'
import { useIdeStore } from '../store/useIdeStore'
import { LESSONS } from '../data/lessons'
import { globalVfs } from '../engine/vfs'

export function SidePanel() {
  const rightTab = useIdeStore((s) => s.rightTab)
  const setRightTab = useIdeStore((s) => s.setRightTab)
  const terminalLines = useIdeStore((s) => s.terminalLines)
  const errors = useIdeStore((s) => s.errors)
  const activeLessonId = useIdeStore((s) => s.activeLessonId)
  const selectLesson = useIdeStore((s) => s.selectLesson)
  const lessonMessage = useIdeStore((s) => s.lessonMessage)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [terminalLines, rightTab])

  const lesson = LESSONS.find((l) => l.id === activeLessonId)

  return (
    <aside className="panel side-right">
      <div className="tabs">
        {(['terminal', 'errors', 'lessons', 'vfs'] as const).map((tab) => (
          <button key={tab} className={`tab ${rightTab === tab ? 'active' : ''}`} onClick={() => setRightTab(tab)}>
            {tab === 'terminal' ? 'Terminal' : tab === 'errors' ? `Errors (${errors.length})` : tab === 'lessons' ? 'Lessons' : 'VFS'}
          </button>
        ))}
      </div>
      <div className="side-body">
        {rightTab === 'terminal' && (
          <>
            {terminalLines.map((line, i) => {
              const cls = line.includes('[ERROR]')
                ? 'error'
                : line.includes('[WARN]')
                  ? 'warn'
                  : line.includes('[INFO]')
                    ? 'info'
                    : ''
              return (
                <div key={i} className={`term-line ${cls}`}>
                  {line || ' '}
                </div>
              )
            })}
            <div ref={endRef} />
          </>
        )}

        {rightTab === 'errors' && (
          <>
            {errors.length === 0 && <div className="hint">No errors. Compile to validate your program.</div>}
            {errors.map((e, i) => (
              <div key={i} className="error-item">
                <div className="meta">
                  {e.file}:{e.line}
                  {e.column ? `:${e.column}` : ''} · {e.code}
                </div>
                <div>{e.message}</div>
              </div>
            ))}
          </>
        )}

        {rightTab === 'lessons' && (
          <>
            {lesson && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div className="lesson-track">{lesson.track}</div>
                <h4 style={{ margin: '0 0 0.35rem' }}>{lesson.title}</h4>
                <p className="hint">{lesson.objective}</p>
                <ul className="hint">
                  {lesson.hints.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
                {lessonMessage && (
                  <div className={lessonMessage.startsWith('Pass') ? 'pass-msg' : 'fail-msg'}>{lessonMessage}</div>
                )}
              </div>
            )}
            {LESSONS.map((l) => (
              <div
                key={l.id}
                className={`lesson-card ${l.id === activeLessonId ? 'active' : ''}`}
                onClick={() => selectLesson(l.id)}
              >
                <div className="lesson-track">{l.track}</div>
                <h4>{l.title}</h4>
                <p>{l.objective}</p>
              </div>
            ))}
          </>
        )}

        {rightTab === 'vfs' && (
          <>
            <div className="hint" style={{ marginBottom: 8 }}>
              Simulated jBASE files (in-memory). Seed includes F.CUSTOMER and F.CUSTOMER.ACCOUNT.
            </div>
            <pre className="vfs-pre">{JSON.stringify(globalVfs.snapshot(), null, 2)}</pre>
          </>
        )}
      </div>
    </aside>
  )
}
