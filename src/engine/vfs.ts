/** In-browser virtual jBASE-style file store */

export type VfsFile = Map<string, string> // record id -> record body

export class VirtualFileSystem {
  private files = new Map<string, VfsFile>()
  private handles = new Map<string, string>() // var name -> file path key

  normalize(path: string): string {
    return path.trim().toUpperCase().replace(/^F\./, 'F.')
  }

  open(path: string, handleVar: string): boolean {
    const key = this.normalize(asPath(path))
    if (!this.files.has(key)) {
      this.files.set(key, new Map())
    }
    this.handles.set(handleVar.toUpperCase(), key)
    return true
  }

  close(handleVar: string): void {
    this.handles.delete(handleVar.toUpperCase())
  }

  private fileFor(handleVar: string): VfsFile | null {
    const key = this.handles.get(handleVar.toUpperCase())
    if (!key) return null
    return this.files.get(key) ?? null
  }

  read(handleVar: string, id: string): string | null {
    const f = this.fileFor(handleVar)
    if (!f) return null
    if (!f.has(id)) return null
    return f.get(id)!
  }

  write(handleVar: string, id: string, body: string): boolean {
    const f = this.fileFor(handleVar)
    if (!f) return false
    f.set(id, body)
    return true
  }

  delete(handleVar: string, id: string): boolean {
    const f = this.fileFor(handleVar)
    if (!f) return false
    return f.delete(id)
  }

  clear(handleVar: string): boolean {
    const f = this.fileFor(handleVar)
    if (!f) return false
    f.clear()
    return true
  }

  /** Seed demo banking-ish data */
  seedDemo(): void {
    this.open('F.CUSTOMER', 'F.CUSTOMER')
    this.write('F.CUSTOMER', '100001', ['John Doe', 'Doha', 'ACTIVE', '2'].join(String.fromCharCode(254)))
    this.write('F.CUSTOMER', '100002', ['Sara Ali', 'Muscat', 'ACTIVE', '1'].join(String.fromCharCode(254)))
    this.close('F.CUSTOMER')

    this.open('F.CUSTOMER.ACCOUNT', 'F.CUSTOMER.ACCOUNT')
    this.write(
      'F.CUSTOMER.ACCOUNT',
      '100001',
      ['1000010001', '1000010002'].join(String.fromCharCode(254)),
    )
    this.write('F.CUSTOMER.ACCOUNT', '100002', '1000020001')
    this.close('F.CUSTOMER.ACCOUNT')
  }

  snapshot(): Record<string, Record<string, string>> {
    const out: Record<string, Record<string, string>> = {}
    for (const [k, file] of this.files) {
      out[k] = Object.fromEntries(file.entries())
    }
    return out
  }

  loadSnapshot(data: Record<string, Record<string, string>>): void {
    this.files.clear()
    this.handles.clear()
    for (const [k, recs] of Object.entries(data)) {
      this.files.set(k, new Map(Object.entries(recs)))
    }
  }
}

function asPath(path: string): string {
  return path.replace(/^['"]|['"]$/g, '')
}

export const globalVfs = new VirtualFileSystem()
