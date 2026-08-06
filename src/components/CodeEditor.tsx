import { useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import type { OnMount } from '@monaco-editor/react'
import { useIdeStore } from '../store/useIdeStore'
import * as monaco from 'monaco-editor'

monaco.languages.register({ id: 'jbasic' })
monaco.languages.setMonarchTokensProvider('jbasic', {
  ignoreCase: true,
  tokenizer: {
    root: [
      [/^\s*\*.*$/, 'comment'],
      [/;.*$/, 'comment'],
      [/"[^"]*"/, 'string'],
      [/'[^']*'/, 'string'],
      [/\b\d+(\.\d+)?\b/, 'number'],
      [
        /\b(PROGRAM|SUBROUTINE|FUNCTION|END|RETURN|STOP|ABORT|CRT|PRINT|IF|THEN|ELSE|FOR|NEXT|LOOP|WHILE|UNTIL|REPEAT|GOSUB|GOTO|CALL|OPEN|READ|WRITE|DELETE|CLOSE|CLEARFILE|EQUATE|EQU|DIM|DIMENSION|COMMON|INSERT|INCLUDE|INPUT|EXECUTE|PERFORM|NULL|CASE|BEGIN)\b/,
        'keyword',
      ],
      [/\b(AND|OR|EQ|NE|GT|LT|GE|LE|TO|FROM|ON|STEP|BY|SETTING)\b/, 'keyword'],
      [/\b(LEN|NUM|INT|ABS|CHAR|FIELD|COUNT|DCOUNT|INDEX|DATE|TIME|OCONV|ICONV|TRIM|UPCASE|DOWNCASE|CHANGE|CONVERT|FMT|SYSTEM|SPACE|STR)\b/, 'type'],
      [/[A-Z_@$#.][A-Z0-9_@$#.]*/, 'identifier'],
      [/[<>=+\-*/^#:]+/, 'operator'],
    ],
  },
})

monaco.editor.defineTheme('jb-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6b7c8a', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'E31C23' },
    { token: 'string', foreground: '7DCEA0' },
    { token: 'number', foreground: '5DADE2' },
    { token: 'type', foreground: 'F0C14B' },
  ],
  colors: {
    'editor.background': '#0a1016',
    'editor.foreground': '#e7eef5',
    'editorLineNumber.foreground': '#4a5d6e',
    'editorCursor.foreground': '#E31C23',
    'editor.selectionBackground': '#E31C2333',
  },
})

export function CodeEditor() {
  const openPath = useIdeStore((s) => s.openPath)
  const content = useIdeStore((s) => s.files[s.openPath] ?? '')
  const setContent = useIdeStore((s) => s.setContent)
  const errors = useIdeStore((s) => s.errors)
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const model = editor.getModel()
    if (!model) return
    const markers = errors
      .filter((e) => e.file === openPath || openPath.endsWith(e.file))
      .map((e) => ({
        startLineNumber: e.line || 1,
        startColumn: e.column || 1,
        endLineNumber: e.line || 1,
        endColumn: (e.column || 1) + 20,
        message: `[${e.code}] ${e.message}`,
        severity: monaco.MarkerSeverity.Error,
      }))
    monaco.editor.setModelMarkers(model, 'jb-simulator', markers)
  }, [errors, openPath, content])

  return (
    <div className="editor-wrap">
      <div className="editor-path">{openPath || 'No file open'}</div>
      <div className="editor-host">
        <Editor
          height="100%"
          language="jbasic"
          theme="jb-dark"
          value={content}
          path={openPath}
          onChange={(v) => setContent(v ?? '')}
          onMount={(editor) => {
            editorRef.current = editor
          }}
          options={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            renderWhitespace: 'selection',
            wordWrap: 'on',
          }}
        />
      </div>
    </div>
  )
}
