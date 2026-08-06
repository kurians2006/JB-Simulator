import { useMemo, useState } from 'react'
import { JBC1_DOCS, JBC1_LETTERS, JBC1_SOURCE, type JbcDocEntry } from '../data/jbc1Docs'
import { useIdeStore } from '../store/useIdeStore'

export function DocsPanel() {
  const [query, setQuery] = useState('')
  const [letter, setLetter] = useState<string>('All')
  const [filter, setFilter] = useState<'all' | 'supported'>('all')
  const [selected, setSelected] = useState<JbcDocEntry | null>(JBC1_DOCS.find((d) => d.name === 'CRT') ?? null)
  const tryExample = useIdeStore((s) => s.tryExample)

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase()
    return JBC1_DOCS.filter((d) => {
      if (filter === 'supported' && !d.supported) return false
      if (letter !== 'All' && d.letter !== letter) return false
      if (!q) return true
      return (
        d.name.toUpperCase().includes(q) ||
        d.summary.toUpperCase().includes(q) ||
        d.beginner.toUpperCase().includes(q)
      )
    })
  }, [query, letter, filter])

  const supportedCount = JBC1_DOCS.filter((d) => d.supported).length

  return (
    <div className="docs-panel">
      <div className="hint" style={{ marginBottom: 8 }}>
        Beginner guide for all <strong>{JBC1_DOCS.length}</strong> jBC statements/functions from{' '}
        <a href={JBC1_SOURCE} target="_blank" rel="noreferrer">
          JBC1
        </a>
        . <strong>{supportedCount}</strong> have runnable examples in this simulator.
      </div>

      <input
        className="docs-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search CRT, IF, OPEN, FIELD..."
      />

      <div className="docs-filters">
        <button className={`btn ${filter === 'all' ? 'btn-primary' : ''}`} onClick={() => setFilter('all')}>
          All
        </button>
        <button className={`btn ${filter === 'supported' ? 'btn-primary' : ''}`} onClick={() => setFilter('supported')}>
          Runnable
        </button>
      </div>

      <div className="docs-letters">
        <button className={`letter ${letter === 'All' ? 'active' : ''}`} onClick={() => setLetter('All')}>
          All
        </button>
        {JBC1_LETTERS.map((L) => (
          <button key={L} className={`letter ${letter === L ? 'active' : ''}`} onClick={() => setLetter(L)}>
            {L}
          </button>
        ))}
      </div>

      <div className="docs-layout">
        <div className="docs-list">
          {filtered.map((d) => (
            <button
              key={`${d.name}-${d.kind}-${d.summary.slice(0, 24)}`}
              className={`docs-item ${selected?.name === d.name && selected.summary === d.summary ? 'active' : ''}`}
              onClick={() => setSelected(d)}
            >
              <span className="docs-item-name">{d.name}</span>
              <span className="docs-item-meta">
                {d.kind}
                {d.supported ? ' · try' : ''}
              </span>
            </button>
          ))}
          {filtered.length === 0 && <div className="hint">No matches.</div>}
        </div>

        {selected && (
          <div className="docs-detail">
            <div className="lesson-track">{selected.kind}</div>
            <h4 style={{ margin: '0 0 0.35rem', fontFamily: 'var(--font)' }}>{selected.name}</h4>
            <p className="hint">{selected.summary}</p>
            <p style={{ fontFamily: 'var(--font)', fontSize: '0.85rem', lineHeight: 1.45 }}>{selected.beginner}</p>

            {selected.supported && selected.example ? (
              <>
                <pre className="docs-example">{selected.example}</pre>
                <button
                  className="btn btn-primary"
                  onClick={() => tryExample(selected.name, selected.example!)}
                  style={{ marginTop: 8 }}
                >
                  Open & Run example
                </button>
              </>
            ) : (
              <div className="hint" style={{ marginTop: 8 }}>
                Explained for learning. Not runnable in this free simulator yet (needs full jBASE/TAFJ runtime).
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
