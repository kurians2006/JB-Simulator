import { useIdeStore } from '../store/useIdeStore'

export function StatusBar() {
  const status = useIdeStore((s) => s.status)
  const openPath = useIdeStore((s) => s.openPath)
  const busy = useIdeStore((s) => s.busy)

  return (
    <footer className="status-bar">
      <span>{busy ? '● running' : '○ idle'} — {status}</span>
      <span>{openPath}</span>
    </footer>
  )
}
