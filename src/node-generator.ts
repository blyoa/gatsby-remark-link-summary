import { Link } from 'mdast'
import { Node } from 'unist'

/**
 * Parameters for HTMLGenerator.
 *
 * @param metadata - `metadata` that is scraped by metascraper.
 * @param originalNode - `originalNode` is going to be replaced by HTMLGenerator.
 * @param cacheRemoteFile - `cacheRemoteFile` fetches a remote file and returns the local path to that file.
 *   if `persistent` is `undefined` or `false`, the file is saved only in `public` directory, and
 *   if `persistent` is true, the file is also saved in the cache directory specified in the plugin configuration and
 *   are reused in the next build.
 */
export interface HTMLGeneratorParams {
  metadata: Record<string, string>
  originalNode: Link
  cacheRemoteFile: (fileURL: string, persistent?: boolean) => Promise<string>
}

export type HTMLGenerator = (
  params: HTMLGeneratorParams
) => string | Node | Promise<string | Node>
