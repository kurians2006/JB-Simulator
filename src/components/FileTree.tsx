import { useIdeStore } from '../store/useIdeStore'

export function FileTree() {
  const files = useIdeStore((s) => s.files)
  const openPath = useIdeStore((s) => s.openPath)
  const setOpenPath = useIdeStore((s) => s.setOpenPath)
  const createFile = useIdeStore((s) => s.createFile)
  const deleteFile = useIdeStore((s) => s.deleteFile)

  const paths = Object.keys(files).sort()

  return (
    <aside className="panel">
      <div className="panel-title">
        <span>BP / Sources</span>
        <div className="file-actions">
          <button
            className="btn"
            onClick={() => {
              const name = window.prompt('New program name (e.g. MY.PROG)', 'MY.PROG')
              if (name) createFile(name)
            }}
          >
            New
          </button>
        </div>
      </div>
      <div className="file-list">
        {paths.map((path) => (
          <div key={path} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              className={`file-item ${path === openPath ? 'active' : ''}`}
              onClick={() => setOpenPath(path)}
              style={{ flex: 1 }}
            >
              {path}
            </button>
            <button
              className="btn"
              style={{ padding: '0.15rem 0.35rem', fontSize: '0.65rem' }}
              onClick={() => {
                if (window.confirm(`Delete ${path}?`)) deleteFile(path)
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </aside>
  )
}
