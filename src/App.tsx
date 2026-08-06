import { Toolbar } from './components/Toolbar'
import { FileTree } from './components/FileTree'
import { CodeEditor } from './components/CodeEditor'
import { SidePanel } from './components/SidePanel'
import { StatusBar } from './components/StatusBar'

export default function App() {
  return (
    <div className="app">
      <Toolbar />
      <div className="workspace">
        <FileTree />
        <CodeEditor />
        <SidePanel />
      </div>
      <StatusBar />
    </div>
  )
}
