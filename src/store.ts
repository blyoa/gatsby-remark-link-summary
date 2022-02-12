import fs from 'fs/promises'
import path from 'path'
import { ErrorWithCauseMessage } from './error'

const currentCatalogVersion = '1'

export interface SiteSummary {
  metadata: Record<string, string>
  updatedAt: string
  cachedFilePath?: string
}

interface SiteSummaryCatalog {
  version: string
  items: Record<string, SiteSummary>
}

export class CachedSiteSummaryStore {
  private filePath: string | null = null
  private catalog: SiteSummaryCatalog | null = null
  private opened: boolean = false
  private dirty: boolean = false

  private initCatalog() {
    this.catalog = {
      version: currentCatalogVersion,
      items: {},
    }
  }

  async open(filePath: string): Promise<void> {
    if (this.opened) {
      throw new Error('a catalog file was already opened')
    }

    this.filePath = filePath
    this.opened = true

    let data: string | null
    try {
      data = await fs.readFile(filePath, { encoding: 'utf-8' })
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        this.initCatalog()
        return
      }

      throw new ErrorWithCauseMessage('failed to read a catalog file', {
        cause: e,
      })
    }

    let catalog: SiteSummaryCatalog
    try {
      catalog = JSON.parse(data)
    } catch (e) {
      throw new ErrorWithCauseMessage('failed to parse a catalog file', {
        cause: e,
      })
    }
    if (catalog.version !== currentCatalogVersion) {
      throw new Error(
        `unsupported cache file version; loaded-version=${catalog.version}`
      )
    }
    this.catalog = catalog
  }

  findItem(url: string): SiteSummary | null {
    if (!this.opened) {
      throw new Error('a catalog file was not opened yet')
    }

    if (this.catalog?.items == null) {
      return null
    }
    return this.catalog.items[url] || null
  }

  updateItem(url: string, item: SiteSummary) {
    if (!this.opened) {
      throw new Error('a catalog file was not opened yet')
    }

    if (this.catalog == null) {
      this.catalog = {
        version: currentCatalogVersion,
        items: {},
      }
    }
    this.dirty = true
    this.catalog.items[url] = item
  }

  async sync(): Promise<void> {
    if (!this.opened) {
      throw new Error('a catalog file was not opened yet')
    }

    if (this.filePath == null || !this.dirty) {
      return
    }
    this.dirty = false

    const dirPath = path.dirname(this.filePath)
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (e) {
      this.dirty = true
      throw new ErrorWithCauseMessage(
        `failed to create a directory "${dirPath}"`,
        {
          cause: e,
        }
      )
    }

    try {
      await fs.writeFile(
        this.filePath,
        JSON.stringify({
          version: this.catalog?.version ?? currentCatalogVersion,
          items: this.catalog?.items ?? {},
        }),
        {
          encoding: 'utf-8',
        }
      )
    } catch (e) {
      this.dirty = true
      throw new ErrorWithCauseMessage(
        `failed to save a catalog file; filePath=${this.filePath}`,
        {
          cause: e,
        }
      )
    }
  }
}
