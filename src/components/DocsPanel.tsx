import { useEffect, useMemo, useState } from 'react'
import { JBC1_DOCS, JBC1_SOURCE, type JbcDocEntry } from '../data/jbc1Docs'
import {
  DOC_GROUPS,
  docsInGroup,
  getNewcomerSteps,
  groupIdForDoc,
} from '../data/jbcGroups'
import { useIdeStore } from '../store/useIdeStore'

type Mode = 'groups' | 'path'

export function DocsPanel() {
  const [mode, setMode] = useState<Mode>('path')
  const [query, setQuery] = useState('')
  const [groupId, setGroupId] = useState<string>('start')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ start: true })
  const [selected, setSelected] = useState<JbcDocEntry | null>(
    () => getNewcomerSteps()[0] ?? JBC1_DOCS.find((d) => d.name === 'CRT') ?? null,
  )
  const [pathIndex, setPathIndex] = useState(0)
  const tryExample = useIdeStore((s) => s.tryExample)

  const pathSteps = useMemo(() => getNewcomerSteps(), [])
  const supportedCount = useMemo(() => JBC1_DOCS.filter((d) => d.supported).length, [])

  const q = query.trim().toUpperCase()

  const searchHits = useMemo(() => {
    if (!q) return [] as JbcDocEntry[]
    return JBC1_DOCS.filter(
      (d) =>
        d.name.toUpperCase().includes(q) ||
        d.summary.toUpperCase().includes(q) ||
        d.beginner.toUpperCase().includes(q),
    )
  }, [q])

  const groupedCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const g of DOC_GROUPS) counts[g.id] = docsInGroup(g.id).length
    return counts
  }, [])

  useEffect(() => {
    if (mode === 'path' && pathSteps[pathIndex]) {
      setSelected(pathSteps[pathIndex]!)
    }
  }, [mode, pathIndex, pathSteps])

  const selectDoc = (doc: JbcDocEntry) => {
    setSelected(doc)
    const gid = groupIdForDoc(doc)
    setGroupId(gid)
    setOpenGroups((prev) => ({ ...prev, [gid]: true }))
    const idx = pathSteps.findIndex((d) => d.name === doc.name)
    if (idx >= 0) setPathIndex(idx)
  }

  const goPath = (delta: number) => {
    setMode('path')
    setPathIndex((i) => Math.max(0, Math.min(pathSteps.length - 1, i + delta)))
  }

  const activeGroupDocs = useMemo(() => {
    const docs = docsInGroup(groupId)
    if (!q) return docs
    return docs.filter(
      (d) =>
        d.name.toUpperCase().includes(q) ||
        d.summary.toUpperCase().includes(q) ||
        d.beginner.toUpperCase().includes(q),
    )
  }, [groupId, q])

  return (
    <div className="docs-panel">
      <div className="hint" style={{ marginBottom: 8 }}>
        <strong>{JBC1_DOCS.length}</strong> topics from{' '}
        <a href={JBC1_SOURCE} target="_blank" rel="noreferrer">
          JBC1
        </a>
        , organised into groups. Unsupported items stay visible for learning.{" "}
        <strong>{supportedCount}</strong> are runnable here.
      </div>

      <div className="docs-filters">
        <button
          className={`btn ${mode === 'path' ? 'btn-primary' : ''}`}
          onClick={() => {
            setMode('path')
            setQuery('')
          }}
        >
          Newcomer path
        </button>
        <button
          className={`btn ${mode === 'groups' ? 'btn-primary' : ''}`}
          onClick={() => setMode('groups')}
        >
          Topic groups
        </button>
      </div>

      <input
        className="docs-search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          if (e.target.value.trim()) setMode('groups')
        }}
        placeholder="Search CRT, IF, OPEN, FIELD..."
      />

      {mode === 'path' && !q && (
        <div className="path-card">
          <div className="path-progress">
            Step {pathIndex + 1} of {pathSteps.length}
            <div className="path-bar">
              <div
                className="path-bar-fill"
                style={{ width: `${((pathIndex + 1) / Math.max(1, pathSteps.length)) * 100}%` }}
              />
            </div>
          </div>
          <div className="path-actions">
            <button className="btn" disabled={pathIndex <= 0} onClick={() => goPath(-1)}>
              Previous
            </button>
            <button className="btn" disabled={pathIndex >= pathSteps.length - 1} onClick={() => goPath(1)}>
              Next topic
            </button>
          </div>
          <div className="hint" style={{ marginTop: 6 }}>
            Follow this path in order — each stop opens an explanation{selected?.supported ? ' and example' : ''}.
          </div>
        </div>
      )}

      {mode === 'groups' && !q && (
        <div className="group-list">
          {DOC_GROUPS.map((g) => {
            const open = !!openGroups[g.id]
            const count = groupedCounts[g.id] ?? 0
            return (
              <div key={g.id} className={`group-block ${groupId === g.id ? 'active' : ''}`}>
                <button
                  className="group-head"
                  onClick={() => {
                    setGroupId(g.id)
                    setOpenGroups((prev) => ({ ...prev, [g.id]: !open }))
                  }}
                >
                  <span>
                    {open ? '▾' : '▸'} {g.title}
                  </span>
                  <span className="docs-item-meta">{count}</span>
                </button>
                {open && (
                  <div className="group-body">
                    <p className="hint" style={{ margin: '0 0 0.35rem' }}>
                      {g.blurb}
                    </p>
                    {docsInGroup(g.id).map((d) => (
                      <button
                        key={`${d.name}-${d.summary.slice(0, 20)}`}
                        className={`docs-item ${selected?.name === d.name && selected.summary === d.summary ? 'active' : ''}`}
                        onClick={() => selectDoc(d)}
                      >
                        <span className="docs-item-name">{d.name}</span>
                        <span className="docs-item-meta">
                          {d.supported ? 'try' : 'learn'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {q && (
        <div className="docs-list" style={{ maxHeight: 160 }}>
          {searchHits.map((d) => (
            <button
              key={`${d.name}-${d.summary.slice(0, 20)}`}
              className={`docs-item ${selected?.name === d.name && selected.summary === d.summary ? 'active' : ''}`}
              onClick={() => selectDoc(d)}
            >
              <span className="docs-item-name">{d.name}</span>
              <span className="docs-item-meta">{groupIdForDoc(d)}</span>
            </button>
          ))}
          {searchHits.length === 0 && <div className="hint">No matches.</div>}
        </div>
      )}

      {mode === 'groups' && !q && activeGroupDocs.length === 0 && (
        <div className="hint">No topics in this group filter.</div>
      )}

      {selected && (
        <div className="docs-detail">
          <div className="lesson-track">
            {selected.kind} · {DOC_GROUPS.find((g) => g.id === groupIdForDoc(selected))?.title ?? 'Group'}
            {selected.supported ? ' · runnable' : ' · reference only'}
          </div>
          <h4 style={{ margin: '0 0 0.35rem', fontFamily: 'var(--font)' }}>{selected.name}</h4>
          <p className="hint">{selected.summary}</p>
          <p style={{ fontFamily: 'var(--font)', fontSize: '0.85rem', lineHeight: 1.45 }}>{selected.beginner}</p>

          {selected.supported && selected.example ? (
            <>
              <pre className="docs-example">{selected.example}</pre>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => tryExample(selected.name, selected.example!)}>
                  Open & Run example
                </button>
                {mode === 'path' && (
                  <button className="btn" disabled={pathIndex >= pathSteps.length - 1} onClick={() => goPath(1)}>
                    Next in path
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="hint" style={{ marginTop: 8 }}>
              Kept visible so you learn the name and purpose. Running it needs full jBASE / Temenos TAFJ.
              {mode === 'path' && (
                <div style={{ marginTop: 8 }}>
                  <button className="btn" disabled={pathIndex >= pathSteps.length - 1} onClick={() => goPath(1)}>
                    Next in path
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
