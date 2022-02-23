import got from 'got'
import { Link } from 'mdast'
import titleRule from 'metascraper-title'
import urlRule from 'metascraper-url'
import path from 'path'
import { remark } from 'remark'
import { removePosition } from 'unist-util-remove-position'
import { deployRemoteFile } from '../src/deploy'
import { CachedSiteSummaryStore, SiteSummary } from '../src/store'

jest.mock('fs/promises')
jest.mock('got')
jest.mock('../src/store')

jest.mock('../src/deploy', () => ({
  deployLocalFile: jest.fn(),
  deployRemoteFile: jest.fn(),
}))

describe('plugin', () => {
  let plugin: typeof import('../src/plugin').default

  beforeEach(() => {
    jest.resetAllMocks()
    jest.isolateModules(async () => {
      plugin = require('../src/plugin').default
    })
    jest.useRealTimers()
  })

  describe('default', () => {
    it('should replace nodes according to a pattern of string', async () => {
      const mockStore = CachedSiteSummaryStore as jest.MockedClass<
        typeof CachedSiteSummaryStore
      >
      mockStore.prototype.open.mockReturnValueOnce(Promise.resolve())
      mockStore.prototype.findItem.mockReturnValueOnce(null)
      mockStore.prototype.updateItem.mockReturnValueOnce(undefined)
      mockStore.prototype.sync.mockReturnValueOnce(Promise.resolve())
      ;(got as unknown as jest.Mock).mockReturnValueOnce({
        body: `<html><head><title>title0</title></head></html>`,
        url: 'https://example.com',
      })
      ;(got as unknown as jest.Mock).mockReturnValueOnce({
        body: `<html><head><title>title1</title></head></html>`,
        url: 'https://example.com/path/to',
      })

      const markdownAST = removePosition(
        remark.parse(`
[link01](https://example.com)

[link02](https://example.com/path/to)

[link03](https://www.example.com)
      `),
        true
      )

      const origNodes: Link[] = []
      const replacedAST = await plugin(
        {
          markdownAST,
        },
        {
          cacheRootDirPath: '/tmp/gatsby-remark-lint-summary/cache',
          destinationSubDirPath: 'link-summary',
          sites: [
            {
              pattern: /^https:\/\/example\.com.*/,
              rules: [urlRule(), titleRule()],
              generator: ({ metadata: { title, url }, originalNode }) => {
                origNodes.push(removePosition(originalNode, true))
                return `<a href="${url}">${title}</a>`
              },
            },
          ],
        }
      )

      expect(replacedAST).toStrictEqual({
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'html',
                value: '<a href="https://example.com">title0</a>',
              },
            ],
          },
          {
            type: 'paragraph',
            children: [
              {
                type: 'html',
                value: '<a href="https://example.com/path/to">title1</a>',
              },
            ],
          },
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                url: 'https://www.example.com',
                title: null,
                children: [
                  {
                    type: 'text',
                    value: 'link03',
                  },
                ],
              },
            ],
          },
        ],
      })

      expect(origNodes).toStrictEqual([
        {
          type: 'link',
          url: 'https://example.com',
          title: null,
          children: [
            {
              type: 'text',
              value: 'link01',
            },
          ],
        },
        {
          type: 'link',
          url: 'https://example.com/path/to',
          title: null,
          children: [
            {
              type: 'text',
              value: 'link02',
            },
          ],
        },
      ])

      expect(mockStore.prototype.sync).toHaveBeenCalledTimes(1)
    })

    it('should replace nodes according to a pattern of a function', async () => {
      const mockStore = CachedSiteSummaryStore as jest.MockedClass<
        typeof CachedSiteSummaryStore
      >
      mockStore.prototype.open.mockReturnValueOnce(Promise.resolve())
      mockStore.prototype.findItem.mockReturnValueOnce(null)
      mockStore.prototype.updateItem.mockReturnValueOnce(undefined)
      mockStore.prototype.sync.mockReturnValueOnce(Promise.resolve())
      ;(got as unknown as jest.Mock).mockReturnValueOnce({
        body: `<html><head><title>title0</title></head></html>`,
        url: 'https://example.com',
      })
      ;(got as unknown as jest.Mock).mockReturnValueOnce({
        body: `<html><head><title>title1</title></head></html>`,
        url: 'https://www.example.com',
      })

      const markdownAST = removePosition(
        remark.parse(`
[](https://example.com)

[link02](https://example.com/path/to)

[--replace--](https://www.example.com)
`),
        true
      )

      const origNodes: Link[] = []
      const replacedAST = await plugin(
        {
          markdownAST,
        },
        {
          cacheRootDirPath: '/tmp/gatsby-remark-lint-summary/cache',
          destinationSubDirPath: 'link-summary',
          sites: [
            {
              pattern: n => {
                if (n.children.length === 0) return true
                const [firstChild] = n.children
                return (
                  firstChild.type === 'text' &&
                  firstChild.value === '--replace--'
                )
              },
              rules: [urlRule(), titleRule()],
              generator: ({ metadata: { title, url }, originalNode }) => {
                origNodes.push(removePosition(originalNode, true))
                return `<a href="${url}">${title}</a>`
              },
            },
          ],
        }
      )

      expect(replacedAST).toStrictEqual({
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'html',
                value: '<a href="https://example.com">title0</a>',
              },
            ],
          },
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                url: 'https://example.com/path/to',
                title: null,
                children: [
                  {
                    type: 'text',
                    value: 'link02',
                  },
                ],
              },
            ],
          },
          {
            type: 'paragraph',
            children: [
              {
                type: 'html',
                value: '<a href="https://www.example.com">title1</a>',
              },
            ],
          },
        ],
      })

      expect(origNodes).toStrictEqual([
        {
          type: 'link',
          url: 'https://example.com',
          title: null,
          children: [],
        },
        {
          type: 'link',
          url: 'https://www.example.com',
          title: null,
          children: [
            {
              type: 'text',
              value: '--replace--',
            },
          ],
        },
      ])

      expect(mockStore.prototype.open).toHaveBeenCalledTimes(1)
      expect(mockStore.prototype.sync).toHaveBeenCalledTimes(1)
    })

    it('should throw an error if a cache catalog file failed to be opended', async () => {
      const mockStore = CachedSiteSummaryStore as jest.MockedClass<
        typeof CachedSiteSummaryStore
      >
      mockStore.prototype.open.mockReturnValueOnce(
        Promise.reject(new Error('dummy open error'))
      )

      const markdownAST = removePosition(
        remark.parse(`[link01](https://example.com)`),
        true
      )

      await expect(
        plugin(
          {
            markdownAST,
          },
          {
            cacheRootDirPath: '/tmp/gatsby-remark-lint-summary/cache',
            destinationSubDirPath: 'link-summary',
            sites: [
              {
                pattern: /^https:\/\/example\.com.*/,
                rules: [urlRule(), titleRule()],
                generator: ({ metadata: { title, url } }) => {
                  return `<a href="${url}">${title}</a>`
                },
              },
            ],
          }
        )
      ).rejects.toThrowError()

      expect(mockStore.prototype.open).toHaveBeenCalledTimes(1)
      expect(mockStore.prototype.sync).toHaveBeenCalledTimes(0)
    })

    it('should not save a catalog file if cacheRootDirPath is undefined', async () => {
      const mockStore = CachedSiteSummaryStore as jest.MockedClass<
        typeof CachedSiteSummaryStore
      >
      mockStore.prototype.open.mockReturnValueOnce(Promise.resolve())
      mockStore.prototype.findItem.mockReturnValueOnce(null)
      mockStore.prototype.updateItem.mockReturnValueOnce(undefined)
      mockStore.prototype.sync.mockReturnValueOnce(Promise.resolve())
      ;(got as unknown as jest.Mock).mockReturnValueOnce({
        body: `<html><head><title>title</title></head></html>`,
        url: 'https://example.com',
      })

      const markdownAST = removePosition(
        remark.parse(`[link01](https://example.com)`),
        true
      )

      let origNode: Link | null = null
      const replacedAST = await plugin(
        {
          markdownAST,
        },
        {
          destinationSubDirPath: 'link-summary',
          sites: [
            {
              pattern: /^https:\/\/example\.com.*/,
              rules: [urlRule(), titleRule()],
              generator: ({ metadata: { title, url }, originalNode }) => {
                origNode = originalNode
                return `<a href="${url}">${title}</a>`
              },
            },
          ],
        }
      )

      expect(replacedAST).toStrictEqual({
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'html',
                value: '<a href="https://example.com">title</a>',
              },
            ],
          },
        ],
      })

      expect(origNode).toStrictEqual({
        type: 'link',
        url: 'https://example.com',
        title: null,
        children: [
          {
            type: 'text',
            value: 'link01',
          },
        ],
      })

      expect(mockStore.prototype.open).toHaveBeenCalledTimes(1)
      expect(mockStore.prototype.sync).toHaveBeenCalledTimes(0)
    })

    it('should skip links when the links are not URL', async () => {
      const mockStore = CachedSiteSummaryStore as jest.MockedClass<
        typeof CachedSiteSummaryStore
      >
      mockStore.prototype.open.mockReturnValueOnce(Promise.resolve())
      mockStore.prototype.findItem.mockReturnValueOnce(null)
      mockStore.prototype.updateItem.mockReturnValueOnce(undefined)
      mockStore.prototype.sync.mockReturnValueOnce(Promise.resolve())
      ;(got as unknown as jest.Mock).mockReturnValueOnce({
        text: jest.fn(() => {
          return Promise.resolve(
            `<html><head><title>title</title></head></html>`
          )
        }),
      })

      const markdownAST = removePosition(
        remark.parse(`[link01](#heading)`),
        true
      )

      let origNode: Link | null = null
      const replacedAST = await plugin(
        {
          markdownAST,
        },
        {
          cacheRootDirPath: '/tmp/gatsby-remark-lint-summary/cache',
          destinationSubDirPath: 'link-summary',
          sites: [
            {
              pattern: /^https:\/\/example\.com.*/,
              rules: [urlRule(), titleRule()],
              generator: ({ metadata: { title, url }, originalNode }) => {
                origNode = originalNode
                return `<a href="${url}">${title}</a>`
              },
            },
          ],
        }
      )

      expect(replacedAST).toStrictEqual({
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                url: '#heading',
                title: null,
                children: [
                  {
                    type: 'text',
                    value: 'link01',
                  },
                ],
              },
            ],
          },
        ],
      })

      expect(origNode).toBeNull()

      expect(mockStore.prototype.open).toHaveBeenCalledTimes(1)
      expect(mockStore.prototype.sync).toHaveBeenCalledTimes(1)
    })
  })

  describe('fetchMetadata', () => {
    it('should use a cached item if the item is found and fresh', async () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2022-01-02T01:01:01.001Z'))

      const mockStore = CachedSiteSummaryStore as jest.MockedClass<
        typeof CachedSiteSummaryStore
      >
      mockStore.prototype.open.mockReturnValueOnce(Promise.resolve())
      mockStore.prototype.findItem.mockReturnValueOnce({
        metadata: {
          url: 'https://example.com',
          author: 'John Doe',
          date: '2010-01-01T01:01:01.001Z',
          description: 'a dummy website',
          image: 'https://example.com/img/logo.png',
          publisher: 'Dummy Publisher',
          title: 'title',
        },
        updatedAt: '2022-01-01T01:01:01.001Z',
      })
      mockStore.prototype.updateItem.mockReturnValueOnce(undefined)
      mockStore.prototype.sync.mockReturnValueOnce(Promise.resolve())

      const markdownAST = removePosition(
        remark.parse(`[link01](https://example.com)`),
        true
      )

      const replacedAST = await plugin(
        {
          markdownAST,
        },
        {
          cacheRootDirPath: '/tmp/gatsby-remark-lint-summary/cache',
          destinationSubDirPath: 'link-summary',
          sites: [
            {
              pattern: /^https:\/\/example\.com.*/,
              rules: [urlRule(), titleRule()],
              generator: ({ metadata: { title, url } }) => {
                return `<a href="${url}">${title}</a>`
              },
              cacheExpirationSecond: 60 * 60 * 24,
            },
          ],
        }
      )

      expect(replacedAST).toStrictEqual({
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'html',
                value: '<a href="https://example.com">title</a>',
              },
            ],
          },
        ],
      })

      expect(mockStore.prototype.findItem).toHaveBeenCalledTimes(1)
      expect(got as unknown as jest.Mock).toHaveBeenCalledTimes(0)
      expect(mockStore.prototype.updateItem).toHaveBeenCalledTimes(0)
    })

    it('should use a cached item if the item is found but not fresh', async () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2022-01-02T01:01:01.001Z'))

      const mockStore = CachedSiteSummaryStore as jest.MockedClass<
        typeof CachedSiteSummaryStore
      >
      mockStore.prototype.open.mockReturnValueOnce(Promise.resolve())
      mockStore.prototype.findItem.mockReturnValueOnce({
        metadata: {
          url: 'https://example.com',
          author: 'John Doe',
          date: '2010-01-01T01:01:01.001Z',
          description: 'a dummy website',
          image: 'https://example.com/img/logo.png',
          publisher: 'Dummy Publisher',
          title: 'title',
        },
        updatedAt: '2022-01-01T01:01:00.001Z',
      })
      mockStore.prototype.updateItem.mockReturnValueOnce(undefined)
      mockStore.prototype.sync.mockReturnValueOnce(Promise.resolve())
      ;(got as unknown as jest.Mock).mockReturnValueOnce({
        body: `<html><head><title>title</title></head></html>`,
        url: 'https://example.com',
      })

      const markdownAST = removePosition(
        remark.parse(`[link01](https://example.com)`),
        true
      )

      const replacedAST = await plugin(
        {
          markdownAST,
        },
        {
          cacheRootDirPath: '/tmp/gatsby-remark-lint-summary/cache',
          destinationSubDirPath: 'link-summary',
          sites: [
            {
              pattern: /^https:\/\/example\.com.*/,
              rules: [urlRule(), titleRule()],
              generator: ({ metadata: { title, url } }) => {
                return `<a href="${url}">${title}</a>`
              },
              cacheExpirationSecond: 60 * 60 * 24,
            },
          ],
        }
      )

      expect(replacedAST).toStrictEqual({
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'html',
                value: '<a href="https://example.com">title</a>',
              },
            ],
          },
        ],
      })

      expect(mockStore.prototype.findItem).toHaveBeenCalledTimes(1)
      expect(got as unknown as jest.Mock).toHaveBeenCalledTimes(1)
      expect(mockStore.prototype.updateItem).toHaveBeenCalledWith(
        'https://example.com',
        {
          metadata: {
            url: 'https://example.com',
            title: 'title',
          },
          updatedAt: '2022-01-02T01:01:01.001Z',
        }
      )
    })

    it('should fetch an item if a cached item is not found', async () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2022-01-02T01:01:01.001Z'))

      const mockStore = CachedSiteSummaryStore as jest.MockedClass<
        typeof CachedSiteSummaryStore
      >
      mockStore.prototype.open.mockReturnValueOnce(Promise.resolve())
      mockStore.prototype.findItem.mockReturnValueOnce(null)
      mockStore.prototype.updateItem.mockReturnValueOnce(undefined)
      mockStore.prototype.sync.mockReturnValueOnce(Promise.resolve())
      ;(got as unknown as jest.Mock).mockReturnValueOnce({
        body: `<html><head><title>title</title></head></html>`,
        url: 'https://example.com',
      })

      const markdownAST = removePosition(
        remark.parse(`[link01](https://example.com)`),
        true
      )

      const replacedAST = await plugin(
        {
          markdownAST,
        },
        {
          cacheRootDirPath: '/tmp/gatsby-remark-lint-summary/cache',
          destinationSubDirPath: 'link-summary',
          sites: [
            {
              pattern: /^https:\/\/example\.com.*/,
              rules: [urlRule(), titleRule()],
              generator: ({ metadata: { title, url } }) => {
                return `<a href="${url}">${title}</a>`
              },
              cacheExpirationSecond: 60 * 60 * 24,
            },
          ],
        }
      )

      expect(replacedAST).toStrictEqual({
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'html',
                value: '<a href="https://example.com">title</a>',
              },
            ],
          },
        ],
      })

      expect(mockStore.prototype.findItem).toHaveBeenCalledTimes(1)
      expect(got as unknown as jest.Mock).toHaveBeenCalledTimes(1)
      expect(mockStore.prototype.updateItem).toHaveBeenCalledWith(
        'https://example.com',
        {
          metadata: {
            url: 'https://example.com',
            title: 'title',
          },
          updatedAt: '2022-01-02T01:01:01.001Z',
        }
      )
    })
  })

  describe('remoteFileCacher', () => {
    it('should use a cached item if the item is found and fresh', async () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2022-01-02T01:01:01.001Z'))

      const catalog: Record<string, SiteSummary> = {
        'https://example.com': {
          metadata: {
            url: 'https://example.com',
            author: 'John Doe',
            date: '2010-01-01T01:01:01.001Z',
            description: 'a dummy website',
            image: 'https://example.com/img/logo.png',
            publisher: 'Dummy Publisher',
            title: 'title',
          },
          updatedAt: '2022-01-01T01:01:01.001Z',
        },
        'https://example.com/img/logo.png': {
          metadata: {
            url: 'https://example.com/img/logo.png',
          },
          cachedFilePath: '3f73efc9553a69ef394a5948dbe6c27413436384.png',
          updatedAt: '2022-01-01T01:01:01.001Z',
        },
      }

      const mockStore = CachedSiteSummaryStore as jest.MockedClass<
        typeof CachedSiteSummaryStore
      >
      mockStore.prototype.open.mockReturnValueOnce(Promise.resolve())
      mockStore.prototype.findItem.mockImplementation(url => {
        const item = catalog[url]
        return item ?? null
      })
      mockStore.prototype.updateItem.mockReturnValueOnce(undefined)
      mockStore.prototype.sync.mockReturnValueOnce(Promise.resolve())

      const markdownAST = removePosition(
        remark.parse(`[link01](https://example.com)`),
        true
      )

      const replacedAST = await plugin(
        {
          markdownAST,
        },
        {
          cacheRootDirPath: '/tmp/gatsby-remark-lint-summary/cache',
          destinationSubDirPath: 'link-summary',
          sites: [
            {
              pattern: /^https:\/\/example\.com.*/,
              rules: [urlRule(), titleRule()],
              generator: async ({
                metadata: { title, url, image },
                cacheRemoteFile,
              }) => {
                const filePath = await cacheRemoteFile(image!)
                return `<a href="${url}"><img src="${filePath}">${title}</a>`
              },
              cacheExpirationSecond: 60 * 60 * 24,
            },
          ],
        }
      )

      expect(replacedAST).toStrictEqual({
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'html',
                value:
                  '<a href="https://example.com"><img src="/link-summary/3f73efc9553a69ef394a5948dbe6c27413436384.png">title</a>',
              },
            ],
          },
        ],
      })

      expect(mockStore.prototype.findItem).toHaveBeenCalledTimes(2)
      expect(got as unknown as jest.Mock).toHaveBeenCalledTimes(0)
      expect(mockStore.prototype.updateItem).toHaveBeenCalledTimes(0)
    })

    it('should use a cached item if the item is found but not fresh', async () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2022-01-02T01:01:01.001Z'))

      const catalog: Record<string, SiteSummary> = {
        'https://example.com': {
          metadata: {
            url: 'https://example.com',
            author: 'John Doe',
            date: '2010-01-01T01:01:01.001Z',
            description: 'a dummy website',
            image: 'https://example.com/img/logo.png',
            publisher: 'Dummy Publisher',
            title: 'title',
          },
          updatedAt: '2022-01-01T01:01:01.001Z',
        },
        'https://example.com/img/logo.png': {
          metadata: {
            url: 'https://example.com/img/logo.png',
          },
          cachedFilePath: '3f73efc9553a69ef394a5948dbe6c27413436384.png',
          updatedAt: '2022-01-01T01:01:00.001Z',
        },
      }

      const mockStore = CachedSiteSummaryStore as jest.MockedClass<
        typeof CachedSiteSummaryStore
      >
      mockStore.prototype.open.mockReturnValueOnce(Promise.resolve())
      mockStore.prototype.findItem.mockImplementation(url => {
        const item = catalog[url]
        return item ?? null
      })
      mockStore.prototype.updateItem.mockReturnValueOnce(undefined)
      mockStore.prototype.sync.mockReturnValueOnce(Promise.resolve())
      ;(
        deployRemoteFile as jest.MockedFunction<typeof deployRemoteFile>
      ).mockReturnValueOnce(
        Promise.resolve({
          deployedFilePath: path.join(
            'link-summary',
            '3f73efc9553a69ef394a5948dbe6c27413436384.png'
          ),
        })
      )

      const markdownAST = removePosition(
        remark.parse(`[link01](https://example.com)`),
        true
      )

      const replacedAST = await plugin(
        {
          markdownAST,
        },
        {
          cacheRootDirPath: '/tmp/gatsby-remark-lint-summary/cache',
          destinationSubDirPath: 'link-summary',
          sites: [
            {
              pattern: /^https:\/\/example\.com.*/,
              rules: [urlRule(), titleRule()],
              generator: async ({
                metadata: { title, url, image },
                cacheRemoteFile,
              }) => {
                const filePath = await cacheRemoteFile(image!)
                return `<a href="${url}"><img src="${filePath}">${title}</a>`
              },
              cacheExpirationSecond: 60 * 60 * 24,
            },
          ],
        }
      )

      expect(replacedAST).toStrictEqual({
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'html',
                value:
                  '<a href="https://example.com"><img src="/link-summary/3f73efc9553a69ef394a5948dbe6c27413436384.png">title</a>',
              },
            ],
          },
        ],
      })

      expect(mockStore.prototype.findItem).toHaveBeenCalledTimes(2)
      expect(got as unknown as jest.Mock).toHaveBeenCalledTimes(0)
      expect(mockStore.prototype.updateItem).toHaveBeenCalledTimes(0)
    })

    it('should fetch an item if a cached item is not found', async () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2022-01-02T01:01:01.001Z'))

      const catalog: Record<string, SiteSummary> = {
        'https://example.com': {
          metadata: {
            url: 'https://example.com',
            author: 'John Doe',
            date: '2010-01-01T01:01:01.001Z',
            description: 'a dummy website',
            image: 'https://example.com/img/logo.png',
            publisher: 'Dummy Publisher',
            title: 'title',
          },
          updatedAt: '2022-01-01T01:01:01.001Z',
        },
      }

      const mockStore = CachedSiteSummaryStore as jest.MockedClass<
        typeof CachedSiteSummaryStore
      >
      mockStore.prototype.open.mockReturnValueOnce(Promise.resolve())
      mockStore.prototype.findItem.mockImplementation(url => {
        const item = catalog[url]
        return item ?? null
      })
      mockStore.prototype.updateItem.mockReturnValueOnce(undefined)
      mockStore.prototype.sync.mockReturnValueOnce(Promise.resolve())
      ;(
        deployRemoteFile as jest.MockedFunction<typeof deployRemoteFile>
      ).mockReturnValueOnce(
        Promise.resolve({
          cachedFilePath:
            '/tmp/gatsby-remark-lint-summary/cache/items/3f73efc9553a69ef394a5948dbe6c27413436384.png',
          deployedFilePath: path.join(
            'link-summary',
            '3f73efc9553a69ef394a5948dbe6c27413436384.png'
          ),
        })
      )

      const markdownAST = removePosition(
        remark.parse(`[link01](https://example.com)`),
        true
      )

      const replacedAST = await plugin(
        {
          markdownAST,
        },
        {
          cacheRootDirPath: '/tmp/gatsby-remark-lint-summary/cache',
          destinationSubDirPath: 'link-summary',
          sites: [
            {
              pattern: /^https:\/\/example\.com.*/,
              rules: [urlRule(), titleRule()],
              generator: async ({
                metadata: { title, url, image },
                cacheRemoteFile,
              }) => {
                const filePath = await cacheRemoteFile(image!)
                return `<a href="${url}"><img src="${filePath}">${title}</a>`
              },
              cacheExpirationSecond: 60 * 60 * 24,
            },
          ],
        }
      )

      expect(replacedAST).toStrictEqual({
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'html',
                value:
                  '<a href="https://example.com"><img src="/link-summary/3f73efc9553a69ef394a5948dbe6c27413436384.png">title</a>',
              },
            ],
          },
        ],
      })

      expect(mockStore.prototype.findItem).toHaveBeenCalledTimes(2)
      expect(got as unknown as jest.Mock).toHaveBeenCalledTimes(0)
      expect(mockStore.prototype.updateItem).toHaveBeenCalledWith(
        'https://example.com/img/logo.png',
        {
          metadata: {
            url: 'https://example.com/img/logo.png',
          },
          cachedFilePath: '3f73efc9553a69ef394a5948dbe6c27413436384.png',
          updatedAt: '2022-01-02T01:01:01.001Z',
        }
      )
    })

    it('should save relative path as a cachedFilePath even if cacheRootDirPath is an absolute path', async () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2022-01-02T01:01:01.001Z'))

      const catalog: Record<string, SiteSummary> = {
        'https://example.com': {
          metadata: {
            url: 'https://example.com',
            author: 'John Doe',
            date: '2010-01-01T01:01:01.001Z',
            description: 'a dummy website',
            image: 'https://example.com/img/logo.png',
            publisher: 'Dummy Publisher',
            title: 'title',
          },
          updatedAt: '2022-01-01T01:01:01.001Z',
        },
      }

      const mockStore = CachedSiteSummaryStore as jest.MockedClass<
        typeof CachedSiteSummaryStore
      >
      mockStore.prototype.open.mockReturnValueOnce(Promise.resolve())
      mockStore.prototype.findItem.mockImplementation(url => {
        const item = catalog[url]
        return item ?? null
      })
      mockStore.prototype.updateItem.mockReturnValueOnce(undefined)
      mockStore.prototype.sync.mockReturnValueOnce(Promise.resolve())
      ;(
        deployRemoteFile as jest.MockedFunction<typeof deployRemoteFile>
      ).mockReturnValueOnce(
        Promise.resolve({
          cachedFilePath: path.resolve(
            'gatsby-remark-lint-summary/cache/items/3f73efc9553a69ef394a5948dbe6c27413436384.png'
          ),
          deployedFilePath: path.join(
            'link-summary',
            '3f73efc9553a69ef394a5948dbe6c27413436384.png'
          ),
        })
      )

      const markdownAST = removePosition(
        remark.parse(`[link01](https://example.com)`),
        true
      )

      const replacedAST = await plugin(
        {
          markdownAST,
        },
        {
          cacheRootDirPath: path.resolve('gatsby-remark-lint-summary/cache'),
          destinationSubDirPath: 'link-summary',
          sites: [
            {
              pattern: /^https:\/\/example\.com.*/,
              rules: [urlRule(), titleRule()],
              generator: async ({
                metadata: { title, url, image },
                cacheRemoteFile,
              }) => {
                const filePath = await cacheRemoteFile(image!)
                return `<a href="${url}"><img src="${filePath}">${title}</a>`
              },
              cacheExpirationSecond: 60 * 60 * 24,
            },
          ],
        }
      )

      expect(replacedAST).toStrictEqual({
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'html',
                value:
                  '<a href="https://example.com"><img src="/link-summary/3f73efc9553a69ef394a5948dbe6c27413436384.png">title</a>',
              },
            ],
          },
        ],
      })

      expect(mockStore.prototype.findItem).toHaveBeenCalledTimes(2)
      expect(got as unknown as jest.Mock).toHaveBeenCalledTimes(0)
      expect(mockStore.prototype.updateItem).toHaveBeenCalledWith(
        'https://example.com/img/logo.png',
        {
          metadata: {
            url: 'https://example.com/img/logo.png',
          },
          cachedFilePath: '3f73efc9553a69ef394a5948dbe6c27413436384.png',
          updatedAt: '2022-01-02T01:01:01.001Z',
        }
      )
    })
  })
})
