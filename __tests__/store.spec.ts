import fsPromise from 'fs/promises'
import path from 'path'
import { CachedSiteSummaryStore } from '../src/store'

jest.mock('fs')
jest.mock('fs/promises')
jest.mock('got', () => ({
  got: {
    stream: jest.fn(),
  },
}))

describe('store', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  describe('CachedSiteSummaryStore', () => {
    const siteCatalog = {
      version: '1',
      items: {
        'https://example.com/01': {
          metadata: {
            url: 'https://example.com/01',
            author: 'John Doe',
            date: '2010-01-01T01:01:01.001Z',
            description: 'a dummy website',
            image: 'https://example.com/img/logo.png',
            publisher: 'Dummy Publisher',
            title: 'Example Domain',
          },
          updatedAt: '2022-01-01T01:01:01.001Z',
        },
        'https://example.com/02': {
          metadata: {
            url: 'https://example.com/02',
            author: 'Jane Doe',
            date: '2020-02-02T02:02:02.002Z',
            description: 'a dummy website',
            image: 'https://example.com/img/logo.png',
            publisher: 'Dummy Publisher',
            title: 'Example Domain',
          },
          updatedAt: '2022-02-02T02:02:02.002Z',
        },
      },
    } as const

    describe('open', () => {
      it('should succeed if reading and parsing do not cause error', async () => {
        ;(
          fsPromise.readFile as jest.MockedFunction<typeof fsPromise.readFile>
        ).mockResolvedValueOnce(JSON.stringify(siteCatalog))

        const store = new CachedSiteSummaryStore()
        await expect(store.open('dummy.json')).resolves.toBeUndefined()
      })

      it('should throw CacheCatalogNotFoundError if a file is not found and the ENOENT error is thrown', async () => {
        const enoentErr: NodeJS.ErrnoException = new Error(
          'ENOENT: no such file or directory'
        )
        enoentErr.code = 'ENOENT'
        enoentErr.errno = 2
        ;(
          fsPromise.readFile as jest.MockedFunction<typeof fsPromise.readFile>
        ).mockRejectedValueOnce(enoentErr)

        const store = new CachedSiteSummaryStore()
        await expect(store.open('dummy.json')).resolves.toBeUndefined()
      })

      it('should throw an error if an error excluding the ENOENT is thrown during reading a file', async () => {
        ;(
          fsPromise.readFile as jest.MockedFunction<typeof fsPromise.readFile>
        ).mockRejectedValueOnce(new Error('dummy readFile error'))

        const store = new CachedSiteSummaryStore()
        await expect(store.open('dummy.json')).rejects.toThrowError()
      })

      it('should throw an error if a file fails to be parsed as a JSON object', async () => {
        ;(
          fsPromise.readFile as jest.MockedFunction<typeof fsPromise.readFile>
        ).mockResolvedValueOnce(`{`)

        const store = new CachedSiteSummaryStore()
        await expect(store.open('dummy.json')).rejects.toThrowError()
      })

      it('should throw an error if a catalog version is not supported', async () => {
        const unsupportedCatalog = {
          ...siteCatalog,
          version: 'unsupported',
        }
        ;(
          fsPromise.readFile as jest.MockedFunction<typeof fsPromise.readFile>
        ).mockResolvedValueOnce(JSON.stringify(unsupportedCatalog))

        const store = new CachedSiteSummaryStore()
        await expect(store.open('dummy.json')).rejects.toThrowError()
      })
    })

    describe('findItem', () => {
      it('should return an item if a requested url is stored', async () => {
        ;(
          fsPromise.readFile as jest.MockedFunction<typeof fsPromise.readFile>
        ).mockResolvedValueOnce(JSON.stringify(siteCatalog))

        const store = new CachedSiteSummaryStore()
        await expect(store.open('dummy.json')).resolves.toBeUndefined()

        expect(store.findItem('https://example.com/01')).toStrictEqual(
          siteCatalog.items['https://example.com/01']
        )
      })

      it('should return null if a requested url is not stored', async () => {
        ;(
          fsPromise.readFile as jest.MockedFunction<typeof fsPromise.readFile>
        ).mockResolvedValueOnce(JSON.stringify(siteCatalog))

        const store = new CachedSiteSummaryStore()
        await expect(store.open('dummy.json')).resolves.toBeUndefined()

        expect(store.findItem('https://example.com/99')).toBeNull()
      })

      it('should throw an error if the store is not open', async () => {
        const store = new CachedSiteSummaryStore()
        expect(() => store.findItem('https://example.com/01')).toThrowError()
      })
    })

    describe('updateItem', () => {
      it('should overwrite an item if a requested url is stored', async () => {
        const item = {
          metadata: {
            url: 'https://example.com/01',
            author: 'John Doe',
            date: '2010-09-09T09:09:09.009Z',
            description: 'a dummy website',
            image: 'https://example.com/img/logo.png',
            publisher: 'Dummy Publisher',
            title: 'Example Domain',
          },
          updatedAt: '2022-09-09T09:09:09.009Z',
        }

        ;(
          fsPromise.readFile as jest.MockedFunction<typeof fsPromise.readFile>
        ).mockResolvedValueOnce(JSON.stringify(siteCatalog))

        const store = new CachedSiteSummaryStore()
        await expect(store.open('dummy.json')).resolves.toBeUndefined()
        expect(store.findItem('https://example.com/01')).toStrictEqual(
          siteCatalog.items['https://example.com/01']
        )

        store.updateItem('https://example.com/01', item)

        expect(store.findItem('https://example.com/01')).toStrictEqual(item)
      })

      it('should add an item if a requested url is not stored', async () => {
        const item = {
          metadata: {
            url: 'https://example.com/01',
            author: 'John Doe',
            date: '2010-09-09T09:09:09.009Z',
            description: 'a dummy website',
            image: 'https://example.com/img/logo.png',
            publisher: 'Dummy Publisher',
            title: 'Example Domain',
          },
          updatedAt: '2022-09-09T09:09:09.009Z',
        }
        ;(
          fsPromise.readFile as jest.MockedFunction<typeof fsPromise.readFile>
        ).mockResolvedValueOnce(JSON.stringify(siteCatalog))

        const store = new CachedSiteSummaryStore()
        await expect(store.open('dummy.json')).resolves.toBeUndefined()
        expect(store.findItem('https://example.com/99')).toBeNull()

        store.updateItem('https://example.com/99', item)

        expect(store.findItem('https://example.com/99')).toStrictEqual(item)
      })

      it('should throw an error if the store is not open', async () => {
        const item = {
          metadata: {
            url: 'https://example.com/01',
            author: 'John Doe',
            date: '2010-09-09T09:09:09.009Z',
            description: 'a dummy website',
            image: 'https://example.com/img/logo.png',
            publisher: 'Dummy Publisher',
            title: 'Example Domain',
          },
          updatedAt: '2022-09-09T09:09:09.009Z',
        }

        const store = new CachedSiteSummaryStore()
        expect(() =>
          store.updateItem('https://example.com/01', item)
        ).toThrowError()
      })
    })

    describe('sync', () => {
      it('should not write items to a file if any item is updated', async () => {
        ;(
          fsPromise.readFile as jest.MockedFunction<typeof fsPromise.readFile>
        ).mockResolvedValueOnce(JSON.stringify(siteCatalog))
        const catalogFilePath = 'dummy.json'

        const store = new CachedSiteSummaryStore()
        await expect(store.open(catalogFilePath)).resolves.toBeUndefined()
        await expect(store.sync()).resolves.toBeUndefined()

        expect(fsPromise.mkdir).not.toHaveBeenCalledWith(
          path.dirname(catalogFilePath),
          { recursive: true }
        )
        expect(fsPromise.writeFile).not.toHaveBeenCalledWith(
          catalogFilePath,
          JSON.stringify(siteCatalog),
          { encoding: 'utf-8' }
        )
      })

      it('should succeed if mkdir and writeFile do not cause error', async () => {
        const item = {
          metadata: {
            url: 'https://example.com/01',
            author: 'John Doe',
            date: '2010-01-01T01:01:01.001Z',
            description: 'a dummy website',
            image: 'https://example.com/img/logo.png',
            publisher: 'Dummy Publisher',
            title: 'Example Domain',
          },
          updatedAt: '2022-01-01T01:01:01.001Z',
        }
        ;(
          fsPromise.readFile as jest.MockedFunction<typeof fsPromise.readFile>
        ).mockResolvedValueOnce(JSON.stringify(siteCatalog))
        const catalogFilePath = 'dummy.json'

        const store = new CachedSiteSummaryStore()
        await expect(store.open(catalogFilePath)).resolves.toBeUndefined()
        expect(() =>
          store.updateItem('https://example.com/01', item)
        ).not.toThrowError()
        await expect(store.sync()).resolves.toBeUndefined()

        expect(fsPromise.mkdir).toHaveBeenCalledWith(
          path.dirname(catalogFilePath),
          { recursive: true }
        )
        expect(fsPromise.writeFile).toHaveBeenCalledWith(
          catalogFilePath,
          JSON.stringify(siteCatalog),
          { encoding: 'utf-8' }
        )
      })

      it('should fails if mkdir causes error', async () => {
        const item = {
          metadata: {
            url: 'https://example.com/01',
            author: 'John Doe',
            date: '2010-01-01T01:01:01.001Z',
            description: 'a dummy website',
            image: 'https://example.com/img/logo.png',
            publisher: 'Dummy Publisher',
            title: 'Example Domain',
          },
          updatedAt: '2022-01-01T01:01:01.001Z',
        }
        ;(
          fsPromise.readFile as jest.MockedFunction<typeof fsPromise.readFile>
        ).mockResolvedValueOnce(JSON.stringify(siteCatalog))
        ;(fsPromise.mkdir as jest.Mock).mockRejectedValueOnce(
          new Error('dummy mkdir error')
        )
        const catalogFilePath = 'dummy.json'

        const store = new CachedSiteSummaryStore()
        await expect(store.open(catalogFilePath)).resolves.toBeUndefined()
        expect(() =>
          store.updateItem('https://example.com/01', item)
        ).not.toThrowError()
        await expect(store.sync()).rejects.toThrowError()

        expect(fsPromise.mkdir).toHaveBeenCalledWith(
          path.dirname(catalogFilePath),
          { recursive: true }
        )
        expect(fsPromise.writeFile).toHaveBeenCalledTimes(0)
      })

      it('should fails if writeFile causes error', async () => {
        const item = {
          metadata: {
            url: 'https://example.com/01',
            author: 'John Doe',
            date: '2010-01-01T01:01:01.001Z',
            description: 'a dummy website',
            image: 'https://example.com/img/logo.png',
            publisher: 'Dummy Publisher',
            title: 'Example Domain',
          },
          updatedAt: '2022-01-01T01:01:01.001Z',
        }
        ;(
          fsPromise.readFile as jest.MockedFunction<typeof fsPromise.readFile>
        ).mockResolvedValueOnce(JSON.stringify(siteCatalog))
        ;(fsPromise.writeFile as jest.Mock).mockRejectedValueOnce(
          new Error('dummy writeFile error')
        )
        const catalogFilePath = 'dummy.json'

        const store = new CachedSiteSummaryStore()
        await expect(store.open(catalogFilePath)).resolves.toBeUndefined()
        expect(() =>
          store.updateItem('https://example.com/01', item)
        ).not.toThrowError()
        await expect(store.sync()).rejects.toThrowError()

        expect(fsPromise.mkdir).toHaveBeenCalledWith(
          path.dirname(catalogFilePath),
          { recursive: true }
        )
        expect(fsPromise.writeFile).toHaveBeenCalledWith(
          catalogFilePath,
          JSON.stringify(siteCatalog),
          { encoding: 'utf-8' }
        )
      })
    })
  })
})
