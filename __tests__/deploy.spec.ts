import fs from 'fs'
import fsPromise from 'fs/promises'
import got from 'got'
import path from 'path'
import stream from 'stream'
import { deployLocalFile, deployRemoteFile } from '../src/deploy'

jest.mock('fs')
jest.mock('fs/promises')
jest.mock('got')

class SpyWriteStream extends stream.PassThrough implements fs.WriteStream {
  bytesWritten: number = 0
  path: string | Buffer = ''
  pending: boolean = false

  close(callback?: (err?: NodeJS.ErrnoException) => void): void {
    if (callback) callback()
  }
}

describe('deploy', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  describe('deployLocalFile', () => {
    it('should move a local file to a file in the destination directory when `keepFileInCacheDir` is false', async () => {
      const cacheDirPath = path.join('gatsby-remark-lint-summary', 'items')
      const expectedLocalFilePath = path.join(
        cacheDirPath,
        'fb8964683825da4f142c382f09fab305bcaa0bd0.txt'
      )

      const expectedDeployedDirPath = path.join('public', 'dest')
      const expectedDeployedFilePath = path.join(
        expectedDeployedDirPath,
        'fb8964683825da4f142c382f09fab305bcaa0bd0.txt'
      )

      await expect(
        deployLocalFile(expectedLocalFilePath, expectedDeployedFilePath, false)
      ).resolves.toBeUndefined()

      expect(fsPromise.mkdir).toHaveBeenCalledWith(expectedDeployedDirPath, {
        recursive: true,
      })
      expect(fsPromise.rename).toHaveBeenCalledWith(
        expectedLocalFilePath,
        expectedDeployedFilePath
      )
    })

    it('should copy a local file to the destination directory when `keepFileInCacheDir` is true', async () => {
      const cacheDirPath = path.join('gatsby-remark-lint-summary', 'items')
      const expectedLocalFilePath = path.join(
        cacheDirPath,
        'fb8964683825da4f142c382f09fab305bcaa0bd0.txt'
      )
      const expectedDeployedDirPath = path.join('public', 'dest')
      const expectedDeployedFilePath = path.join(
        expectedDeployedDirPath,
        'fb8964683825da4f142c382f09fab305bcaa0bd0.txt'
      )

      await expect(
        deployLocalFile(expectedLocalFilePath, expectedDeployedFilePath, true)
      ).resolves.toBeUndefined()

      expect(fsPromise.mkdir).toHaveBeenCalledWith(expectedDeployedDirPath, {
        recursive: true,
      })
      expect(fsPromise.copyFile).toHaveBeenCalledWith(
        expectedLocalFilePath,
        expectedDeployedFilePath
      )
    })
  })

  describe('deployRemoteFile', () => {
    it('should remove a fetched file and the directory for the fetched file when `keepFileInCacheDir` is false', async () => {
      ;(got.stream as unknown as jest.Mock).mockReturnValueOnce(
        stream.Readable.from('sample text', { objectMode: false })
      )
      const spyWriteStream = new SpyWriteStream()
      ;(
        fs.createWriteStream as jest.MockedFunction<typeof fs.createWriteStream>
      ).mockReturnValueOnce(spyWriteStream)

      const cacheDirPath = path.join('gatsby-remark-lint-summary', 'items')
      const expectedTmpFilePath = path.join(
        cacheDirPath,
        'tmp-fb8964683825da4f142c382f09fab305bcaa0bd0'
      )
      const expectedCacheFilePath = path.join(
        cacheDirPath,
        '86f441fa0e99f2a36784217a323cea1f5fc0b7f6.txt'
      )

      const dirPathToDeploy = path.join('public', 'dest')
      const expectedDeployedFilePath = path.join(
        dirPathToDeploy,
        '86f441fa0e99f2a36784217a323cea1f5fc0b7f6.txt'
      )

      await expect(
        deployRemoteFile(
          'https://example.com/file.txt',
          dirPathToDeploy,
          cacheDirPath,
          false
        )
      ).resolves.toStrictEqual({
        deployedFilePath: expectedDeployedFilePath,
      })

      let buf = ''
      for await (const chunk of spyWriteStream) {
        buf += chunk.toString()
      }
      expect(buf).toBe('sample text')

      expect(fsPromise.rename).toHaveBeenNthCalledWith(
        1,
        expectedTmpFilePath,
        expectedCacheFilePath
      )
      expect(fsPromise.rename).toHaveBeenNthCalledWith(
        2,
        expectedCacheFilePath,
        expectedDeployedFilePath
      )
      expect(fsPromise.rm).toHaveBeenCalledTimes(0)
    })

    it('should copy a fetched file when `keepFileInCacheDir` is true', async () => {
      ;(got.stream as unknown as jest.Mock).mockReturnValueOnce(
        stream.Readable.from('sample text', { objectMode: false })
      )

      const spyWriteStream = new SpyWriteStream()
      ;(
        fs.createWriteStream as jest.MockedFunction<typeof fs.createWriteStream>
      ).mockReturnValueOnce(spyWriteStream)

      const cacheDirPath = path.join('gatsby-remark-lint-summary', 'items')
      const expectedTmpFilePath = path.join(
        cacheDirPath,
        'tmp-fb8964683825da4f142c382f09fab305bcaa0bd0'
      )
      const expectedCacheFilePath = path.join(
        cacheDirPath,
        '86f441fa0e99f2a36784217a323cea1f5fc0b7f6.txt'
      )

      const dirPathToDeploy = path.join('public', 'dest')
      const expectedDeployedFilePath = path.join(
        dirPathToDeploy,
        '86f441fa0e99f2a36784217a323cea1f5fc0b7f6.txt'
      )

      await expect(
        deployRemoteFile(
          'https://example.com/file.txt',
          dirPathToDeploy,
          cacheDirPath,
          true
        )
      ).resolves.toStrictEqual({
        cachedFilePath: expectedCacheFilePath,
        deployedFilePath: expectedDeployedFilePath,
      })

      let buf = ''
      for await (const chunk of spyWriteStream) {
        buf += chunk.toString()
      }
      expect(buf).toBe('sample text')

      expect(fsPromise.rename).toHaveBeenCalledWith(
        expectedTmpFilePath,
        expectedCacheFilePath
      )
      expect(fsPromise.copyFile).toHaveBeenCalledWith(
        expectedCacheFilePath,
        expectedDeployedFilePath
      )
      expect(fsPromise.rm).toHaveBeenCalledTimes(0)
    })

    it('should handle a file URL that does not have no extension', async () => {
      ;(got.stream as unknown as jest.Mock).mockReturnValueOnce(
        stream.Readable.from('sample text', { objectMode: false })
      )
      const spyWriteStream = new SpyWriteStream()
      ;(
        fs.createWriteStream as jest.MockedFunction<typeof fs.createWriteStream>
      ).mockReturnValueOnce(spyWriteStream)

      const cacheDirPath = path.join('gatsby-remark-lint-summary', 'items')
      const expectedTmpFilePath = path.join(
        cacheDirPath,
        'tmp-6d17ee23f7b78db428eaf2cb08bc2ef1d3add508'
      )
      const expectedCacheFilePath = path.join(
        cacheDirPath,
        '86f441fa0e99f2a36784217a323cea1f5fc0b7f6'
      )

      const dirPathToDeploy = path.join('public', 'dest')
      const expectedDeployedFilePath = path.join(
        dirPathToDeploy,
        '86f441fa0e99f2a36784217a323cea1f5fc0b7f6'
      )

      await expect(
        deployRemoteFile(
          'https://example.com/file',
          dirPathToDeploy,
          cacheDirPath,
          false
        )
      ).resolves.toStrictEqual({
        deployedFilePath: expectedDeployedFilePath,
      })

      let buf = ''
      for await (const chunk of spyWriteStream) {
        buf += chunk.toString()
      }
      expect(buf).toBe('sample text')

      expect(fsPromise.rename).toHaveBeenNthCalledWith(
        1,
        expectedTmpFilePath,
        expectedCacheFilePath
      )
      expect(fsPromise.rename).toHaveBeenNthCalledWith(
        2,
        expectedCacheFilePath,
        expectedDeployedFilePath
      )
      expect(fsPromise.rm).toHaveBeenCalledTimes(0)
    })

    it('should handle a file URL that has query parameters', async () => {
      ;(got.stream as unknown as jest.Mock).mockReturnValueOnce(
        stream.Readable.from('sample text', { objectMode: false })
      )
      const spyWriteStream = new SpyWriteStream()
      ;(
        fs.createWriteStream as jest.MockedFunction<typeof fs.createWriteStream>
      ).mockReturnValueOnce(spyWriteStream)

      const cacheDirPath = path.join('gatsby-remark-lint-summary', 'items')
      const expectedTmpFilePath = path.join(
        cacheDirPath,
        'tmp-0b76a2eb2a57003e7104fc76976e00a4ac9b85b2'
      )
      const expectedCacheFilePath = path.join(
        cacheDirPath,
        '86f441fa0e99f2a36784217a323cea1f5fc0b7f6.txt'
      )

      const dirPathToDeploy = path.join('public', 'dest')
      const expectedDeployedFilePath = path.join(
        dirPathToDeploy,
        '86f441fa0e99f2a36784217a323cea1f5fc0b7f6.txt'
      )

      await expect(
        deployRemoteFile(
          'https://example.com/file.txt?q1=v1&q2=v2',
          dirPathToDeploy,
          cacheDirPath,
          false
        )
      ).resolves.toStrictEqual({
        deployedFilePath: expectedDeployedFilePath,
      })

      let buf = ''
      for await (const chunk of spyWriteStream) {
        buf += chunk.toString()
      }
      expect(buf).toBe('sample text')

      expect(fsPromise.rename).toHaveBeenNthCalledWith(
        1,
        expectedTmpFilePath,
        expectedCacheFilePath
      )
      expect(fsPromise.rename).toHaveBeenNthCalledWith(
        2,
        expectedCacheFilePath,
        expectedDeployedFilePath
      )
      expect(fsPromise.rm).toHaveBeenCalledTimes(0)
    })

    it('should handle a file URL that ends with a slash', async () => {
      ;(got.stream as unknown as jest.Mock).mockReturnValueOnce(
        stream.Readable.from('sample text', { objectMode: false })
      )
      const spyWriteStream = new SpyWriteStream()
      ;(
        fs.createWriteStream as jest.MockedFunction<typeof fs.createWriteStream>
      ).mockReturnValueOnce(spyWriteStream)

      const cacheDirPath = path.join('gatsby-remark-lint-summary', 'items')
      const expectedTmpFilePath = path.join(
        cacheDirPath,
        'tmp-b559c7edd3fb67374c1a25e739cdd7edd1d79949'
      )
      const expectedCacheFilePath = path.join(
        cacheDirPath,
        '86f441fa0e99f2a36784217a323cea1f5fc0b7f6'
      )

      const dirPathToDeploy = path.join('public', 'dest')
      const expectedDeployedFilePath = path.join(
        dirPathToDeploy,
        '86f441fa0e99f2a36784217a323cea1f5fc0b7f6'
      )

      await expect(
        deployRemoteFile(
          'https://example.com/',
          dirPathToDeploy,
          cacheDirPath,
          false
        )
      ).resolves.toStrictEqual({
        deployedFilePath: expectedDeployedFilePath,
      })

      let buf = ''
      for await (const chunk of spyWriteStream) {
        buf += chunk.toString()
      }
      expect(buf).toBe('sample text')

      expect(fsPromise.rename).toHaveBeenNthCalledWith(
        1,
        expectedTmpFilePath,
        expectedCacheFilePath
      )
      expect(fsPromise.rename).toHaveBeenNthCalledWith(
        2,
        expectedCacheFilePath,
        expectedDeployedFilePath
      )
      expect(fsPromise.rm).toHaveBeenCalledTimes(0)
    })

    it('should detect a file extension and append the extension to a deployed file name', async () => {
      ;(got.stream as unknown as jest.Mock).mockReturnValueOnce(
        stream.Readable.from('<?xml version="1.0" encoding="UTF-8"?>', {
          objectMode: false,
        })
      )
      const spyWriteStream = new SpyWriteStream()
      ;(
        fs.createWriteStream as jest.MockedFunction<typeof fs.createWriteStream>
      ).mockReturnValueOnce(spyWriteStream)

      const cacheDirPath = path.join('gatsby-remark-lint-summary', 'items')
      const expectedTmpFilePath = path.join(
        cacheDirPath,
        'tmp-6d17ee23f7b78db428eaf2cb08bc2ef1d3add508'
      )
      const expectedCacheFilePath = path.join(
        cacheDirPath,
        'ddb0596522818616d502400c18ae04a85ab034ae.xml'
      )

      const dirPathToDeploy = path.join('public', 'dest')
      const expectedDeployedFilePath = path.join(
        dirPathToDeploy,
        'ddb0596522818616d502400c18ae04a85ab034ae.xml'
      )

      await expect(
        deployRemoteFile(
          'https://example.com/file',
          dirPathToDeploy,
          cacheDirPath,
          false
        )
      ).resolves.toStrictEqual({
        deployedFilePath: expectedDeployedFilePath,
      })

      let buf = ''
      for await (const chunk of spyWriteStream) {
        buf += chunk.toString()
      }
      expect(buf).toBe('<?xml version="1.0" encoding="UTF-8"?>')

      expect(fsPromise.rename).toHaveBeenNthCalledWith(
        1,
        expectedTmpFilePath,
        expectedCacheFilePath
      )
      expect(fsPromise.rename).toHaveBeenNthCalledWith(
        2,
        expectedCacheFilePath,
        expectedDeployedFilePath
      )
      expect(fsPromise.rm).toHaveBeenCalledTimes(0)
    })

    it('should remove a fetched file from a cache directory when deployLocalFile fails', async () => {
      ;(got.stream as unknown as jest.Mock).mockReturnValueOnce(
        stream.Readable.from('sample text', { objectMode: false })
      )
      ;(
        fsPromise.rename as jest.MockedFunction<typeof fsPromise.rename>
      ).mockReturnValueOnce(Promise.reject(new Error('dummy rename error')))
      ;(
        fsPromise.rm as jest.MockedFunction<typeof fsPromise.rm>
      ).mockReturnValueOnce(Promise.resolve())

      const spyWriteStream = new SpyWriteStream()
      ;(
        fs.createWriteStream as jest.MockedFunction<typeof fs.createWriteStream>
      ).mockReturnValueOnce(spyWriteStream)

      const cacheDirPath = path.join('gatsby-remark-lint-summary', 'items')
      const expectedTmpFilePath = path.join(
        cacheDirPath,
        'tmp-fb8964683825da4f142c382f09fab305bcaa0bd0'
      )
      const expectedCacheFilePath = path.join(
        cacheDirPath,
        '86f441fa0e99f2a36784217a323cea1f5fc0b7f6.txt'
      )

      const dirPathToDeploy = path.join('public', 'dest')

      await expect(
        deployRemoteFile(
          'https://example.com/file.txt',
          dirPathToDeploy,
          cacheDirPath,
          false
        )
      ).rejects.toThrowError()

      expect(fsPromise.rename).toHaveBeenCalledWith(
        expectedTmpFilePath,
        expectedCacheFilePath
      )
      expect(fsPromise.rm).toHaveBeenCalledWith(expectedTmpFilePath)
    })

    it('should not remove a fetched file when the file is already renamed from a temporal file name', async () => {
      ;(got.stream as unknown as jest.Mock).mockReturnValueOnce(
        stream.Readable.from('sample text', { objectMode: false })
      )
      ;(
        fsPromise.rename as jest.MockedFunction<typeof fsPromise.rename>
      ).mockReturnValueOnce(Promise.resolve())
      ;(
        fsPromise.rename as jest.MockedFunction<typeof fsPromise.rename>
      ).mockReturnValueOnce(Promise.reject(new Error('dummy rename error')))

      const spyWriteStream = new SpyWriteStream()
      ;(
        fs.createWriteStream as jest.MockedFunction<typeof fs.createWriteStream>
      ).mockReturnValueOnce(spyWriteStream)

      const cacheDirPath = path.join('gatsby-remark-lint-summary', 'items')
      const expectedTmpFilePath = path.join(
        cacheDirPath,
        'tmp-fb8964683825da4f142c382f09fab305bcaa0bd0'
      )
      const expectedCacheFilePath = path.join(
        cacheDirPath,
        '86f441fa0e99f2a36784217a323cea1f5fc0b7f6.txt'
      )

      const dirPathToDeploy = path.join('public', 'dest')
      const expectedDeployedFilePath = path.join(
        dirPathToDeploy,
        '86f441fa0e99f2a36784217a323cea1f5fc0b7f6.txt'
      )

      await expect(
        deployRemoteFile(
          'https://example.com/file.txt',
          dirPathToDeploy,
          cacheDirPath,
          false
        )
      ).rejects.toThrowError()

      expect(fsPromise.rename).toHaveBeenNthCalledWith(
        1,
        expectedTmpFilePath,
        expectedCacheFilePath
      )
      expect(fsPromise.rename).toHaveBeenNthCalledWith(
        2,
        expectedCacheFilePath,
        expectedDeployedFilePath
      )
      expect(fsPromise.rm).toHaveBeenCalledTimes(0)
    })
  })
})
