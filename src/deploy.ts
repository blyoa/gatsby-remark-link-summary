import crypto from 'crypto'
import AggregateError from 'es-aggregate-error'
import { FileTypeResult, stream as fileTypeStream } from 'file-type'
import { createWriteStream } from 'fs'
import fs from 'fs/promises'
import got, { Options } from 'got'
import path from 'path'
import stream, { PassThrough } from 'stream'
import { promisify } from 'util'
import url from 'url'
import { ErrorWithCauseMessage } from './error'

const pipeline = promisify(stream.pipeline)

function digest(data: crypto.BinaryLike): string {
  return crypto.createHash('sha1').update(data).digest('hex')
}

async function remove(...items: string[]): Promise<void> {
  const errors: Error[] = []
  for (const f of items) {
    try {
      await fs.rm(f)
    } catch (e) {
      errors.push(
        new ErrorWithCauseMessage(
          `failed to remove "${f}"; please remove it manually`,
          {
            cause: e,
          }
        )
      )
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(errors)
  }
}

async function copyFileWithDir(
  sourceFilePath: string,
  destinationFilePath: string
): Promise<void> {
  const destinationDirPath = path.dirname(destinationFilePath)
  try {
    await fs.mkdir(destinationDirPath, { recursive: true })
  } catch (e) {
    throw new ErrorWithCauseMessage(
      `failed to create a directory "${destinationDirPath}"`,
      { cause: e }
    )
  }

  try {
    await fs.copyFile(sourceFilePath, destinationFilePath)
  } catch (e) {
    throw new ErrorWithCauseMessage(
      `failed to copy a file from "${sourceFilePath}" to "${destinationFilePath}"`,
      { cause: e }
    )
  }
}

async function moveFileWithDir(
  sourceFilePath: string,
  destinationFilePath: string
): Promise<void> {
  const destinationDirPath = path.dirname(destinationFilePath)
  try {
    await fs.mkdir(destinationDirPath, { recursive: true })
  } catch (e) {
    throw new ErrorWithCauseMessage(
      `failed to create a directory "${destinationDirPath}"`,
      {
        cause: e,
      }
    )
  }

  try {
    await fs.rename(sourceFilePath, destinationFilePath)
  } catch (e) {
    throw new ErrorWithCauseMessage(
      `failed to move a file from "${sourceFilePath}" to "${destinationFilePath}"`,
      { cause: e }
    )
  }
}

interface FetchedResult {
  fileType: FileTypeResult | undefined
  contentHash: string
}

async function fetchRemoteFile(
  fileURL: string,
  destinationFilePath: string,
  gotOptions: Options = {}
): Promise<FetchedResult> {
  const responseStream = got.stream(fileURL, {
    ...gotOptions,
    isStream: true,
    responseType: 'buffer',
  })

  // Do not pass `responseStream` directly to fileTypeStream to avoid an error.
  // `responseStream` causes an error when `responseStream.pipe` was called
  // after `responseStream._read`, and
  // `fileTypeStream` calls these methods in that order.
  const intermediateStream = new PassThrough()
  responseStream.pipe(intermediateStream)

  const hashPass = new PassThrough()
  const hash = crypto.createHash('sha1')
  hashPass.pipe(hash)

  const ftStream = await fileTypeStream(intermediateStream)
  const fileStream = createWriteStream(destinationFilePath)
  await pipeline(ftStream, hashPass, fileStream)

  return {
    fileType: ftStream.fileType,
    contentHash: hash.digest('hex'),
  }
}

export interface CacheResult {
  cachedFilePath?: string
  deployedFilePath: string
}

export async function deployLocalFile(
  sourceFilePath: string,
  destinationFilePath: string,
  keepOriginalFile: boolean = false
): Promise<void> {
  if (keepOriginalFile) {
    try {
      await copyFileWithDir(sourceFilePath, destinationFilePath)
    } catch (e) {
      throw new ErrorWithCauseMessage('failed to deploy a local file', {
        cause: e,
      })
    }
    return
  }

  try {
    await moveFileWithDir(sourceFilePath, destinationFilePath)
  } catch (e) {
    throw new ErrorWithCauseMessage('failed to deploy a local file', {
      cause: e,
    })
  }
}

export async function deployRemoteFile(
  fileURL: string,
  destinationDirPath: string,
  cacheDirPath: string,
  keepFileInCacheDir: boolean = false,
  gotOptions: Options = {}
): Promise<CacheResult> {
  const tmpFilePath = path.join(cacheDirPath, `tmp-${digest(fileURL)}`)

  try {
    await fs.mkdir(cacheDirPath, { recursive: true })
  } catch (e) {
    throw new ErrorWithCauseMessage(
      `failed to create a directory "${cacheDirPath}"`,
      {
        cause: e,
      }
    )
  }

  const { fileType: ft, contentHash } = await fetchRemoteFile(
    fileURL,
    tmpFilePath,
    gotOptions
  )

  const parsedPath = path.parse(new url.URL(fileURL).pathname)
  let fileExt = parsedPath.ext
  if (fileExt === '' && ft?.ext != null) {
    fileExt = `.${ft.ext}`
  }
  const remoteFileName = `${contentHash}${fileExt}`
  const cacheFilePath = path.join(cacheDirPath, remoteFileName)

  try {
    await moveFileWithDir(tmpFilePath, cacheFilePath)
  } catch (e) {
    const err = new ErrorWithCauseMessage('failed to deploy a remote file', {
      cause: e,
    })
    try {
      await remove(tmpFilePath)
    } catch (ee) {
      throw new AggregateError([err, ee])
    }
    throw err
  }

  const filePathToDeploy = path.join(destinationDirPath, remoteFileName)
  await deployLocalFile(cacheFilePath, filePathToDeploy, keepFileInCacheDir)

  if (!keepFileInCacheDir) {
    return {
      deployedFilePath: filePathToDeploy,
    }
  }

  return {
    cachedFilePath: cacheFilePath,
    deployedFilePath: filePathToDeploy,
  }
}
