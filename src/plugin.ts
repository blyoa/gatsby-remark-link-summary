import got, { Options } from 'got'
import { HTML, Link } from 'mdast'
import metascraper, { Rule } from 'metascraper'
import os from 'os'
import path from 'path'
import { Node } from 'unist'
import { isWebUri } from 'valid-url'
import { visit, Visitor } from './async-visit'
import { deployLocalFile, deployRemoteFile } from './deploy'
import { HTMLGenerator } from './node-generator'
import { CachedSiteSummaryStore, SiteSummary } from './store'

const deploymentDirName = 'public'
const cacheCatalogFileName = 'catalog.json'
const cacheItemDirName = 'items'

let storeOpen = false
const store = new CachedSiteSummaryStore()

interface ScrapingOptions {
  rules: Rule[]
  gotOptions?: Options
  cacheExpirationSecond?: number
}

interface SiteOptions extends ScrapingOptions {
  pattern: RegExp | ((node: Link) => boolean)
  generator: HTMLGenerator
}

export interface PluginOptions {
  cacheRootDirPath?: string
  destinationSubDirPath?: string
  sites: SiteOptions[]
}

function matchesToLink(
  link: Link,
  pattern: RegExp | ((node: Link) => boolean)
): boolean {
  if (typeof pattern === 'function') {
    return pattern(link)
  }
  return link.url.search(pattern) !== -1
}

function isFreshItem(
  cachedItem: SiteSummary,
  now: Date,
  expSec?: number
): boolean {
  if (expSec == null) {
    return true
  }
  const expMilliSec = expSec * 1000
  return new Date(cachedItem.updatedAt).getTime() + expMilliSec >= now.getTime()
}

async function fetchMetadata(
  link: Link,
  store: CachedSiteSummaryStore,
  { rules, gotOptions = {}, cacheExpirationSecond }: ScrapingOptions
) {
  const now = new Date()
  let metadata: Record<string, string>

  const cachedItem = store.findItem(link.url)
  if (
    cachedItem != null &&
    isFreshItem(cachedItem, now, cacheExpirationSecond)
  ) {
    metadata = cachedItem.metadata
  } else {
    const resp = await got(link.url, {
      ...gotOptions,
      isStream: false,
      resolveBodyOnly: false,
      responseType: 'text',
    })

    const scrape = metascraper(rules)
    // Metadata defined in the 'metascraper' package has named properties
    // such as author, title, description,
    // but whether the metadata owns the properties depends on the rules, and
    // no properties are owned when no rules are specified.
    // Record<string, string> is probably a more appropriate type for metadata.
    metadata = (await scrape({
      url: resp.url,
      html: resp.body,
    })) as unknown as Record<string, string>
    store.updateItem(link.url, {
      metadata,
      updatedAt: now.toISOString(),
    })
  }
  return metadata
}

function remoteFileCacher(
  cacheRootDirPath: string,
  destinationSubDirPath: string,
  store: CachedSiteSummaryStore,
  { gotOptions = {}, cacheExpirationSecond }: ScrapingOptions
) {
  return async (fileURL: string, persistent = false): Promise<string> => {
    const now = new Date()
    const cacheItemDirPath = path.join(cacheRootDirPath, cacheItemDirName)
    const deploymentDirPath = path.join(
      deploymentDirName,
      destinationSubDirPath
    )

    const fileItem = store.findItem(fileURL)
    if (
      fileItem?.cachedFilePath != null &&
      isFreshItem(fileItem, now, cacheExpirationSecond)
    ) {
      const filePathToDeploy = path.join(
        deploymentDirPath,
        fileItem.cachedFilePath
      )

      await deployLocalFile(
        path.join(cacheItemDirPath, fileItem.cachedFilePath),
        filePathToDeploy,
        persistent
      )
      return path.join('/', destinationSubDirPath, fileItem.cachedFilePath)
    }

    const res = await deployRemoteFile(
      fileURL,
      deploymentDirPath,
      cacheItemDirPath,
      persistent,
      gotOptions
    )

    if (res.cachedFilePath != null) {
      store.updateItem(fileURL, {
        metadata: {
          url: fileURL,
        },
        cachedFilePath: path.relative(
          path.resolve(cacheItemDirPath),
          path.resolve(res.cachedFilePath)
        ),
        updatedAt: now.toISOString(),
      })
    }

    return path.join(
      '/',
      path.relative(
        path.resolve(deploymentDirName),
        path.resolve(res.deployedFilePath)
      )
    )
  }
}

function nodeReplacer(
  store: CachedSiteSummaryStore,
  {
    cacheRootDirPath,
    destinationSubDirPath = '',
    sites: siteOptions = [],
  }: PluginOptions & Required<Pick<PluginOptions, 'cacheRootDirPath'>>
): Visitor {
  return async (node, parentNode) => {
    if (node.type !== 'link' || parentNode == null) {
      return true
    }
    const link = node as Link
    if (!isWebUri(link.url)) {
      return false
    }

    for (const opts of siteOptions) {
      if (!matchesToLink(link, opts.pattern)) {
        continue
      }

      const metadata = await fetchMetadata(link, store, opts)

      const cacheRemoteFile = remoteFileCacher(
        cacheRootDirPath,
        destinationSubDirPath,
        store,
        opts
      )

      const generatedNode = await opts.generator({
        metadata,
        cacheRemoteFile,
        originalNode: link,
      })

      const newChild: Node =
        typeof generatedNode === 'string'
          ? ({ type: 'html', value: generatedNode } as HTML)
          : generatedNode
      parentNode.children.splice(parentNode.children.indexOf(link), 1, newChild)
      return false
    }
    return true
  }
}

export default async (
  { markdownAST }: { markdownAST: Node },
  pluginOptions: PluginOptions
) => {
  const { cacheRootDirPath = os.tmpdir() } = pluginOptions
  const catalogFilePath = path.join(cacheRootDirPath, cacheCatalogFileName)
  if (!storeOpen) {
    storeOpen = true
    await store.open(catalogFilePath)
  }

  await visit(
    markdownAST,
    nodeReplacer(store, {
      ...pluginOptions,
      cacheRootDirPath,
    })
  )

  if (pluginOptions.cacheRootDirPath != null) {
    await store.sync()
  }

  return markdownAST
}
