/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FileHandle } from './Env'
import Slice from './Slice'
import Footer from './SSTableFooter'
import DataBlock from './SSTableBlock'
import FilterBlock from './SSTableFilterBlock'
import {
  BlockContents,
  BlockHandle,
  CompressionTypes,
  kBlockTrailerSize,
  InternalKey,
  Entry,
} from './Format'
import Status from './Status'
import { Options, ReadOptions } from './Options'
import assert from 'assert'
import { encodeFixed64 } from './Coding'

// Reader
export default class SSTable {
  static async readBlock(
    file: FileHandle,
    options: ReadOptions,
    handle: BlockHandle
  ): Promise<BlockContents> {
    const result = {
      data: new Slice(),
      cachable: false,
      heapAllocated: false,
    } as BlockContents

    // Read the block contents as well as the type/crc footer.
    // See table_builder.cc for the code that built this structure.
    const n = handle.size
    const data = Buffer.alloc(handle.size + kBlockTrailerSize)
    const { bytesRead } = await file.read(data, 0, data.length, handle.offset)

    if (bytesRead !== handle.size + kBlockTrailerSize) {
      throw new Error('truncated block read')
    }

    // TODO Check the crc of the type and the block contents

    switch (data[n]) {
      case CompressionTypes.none:
        result.data = new Slice(data.slice(0, n))
        break
      // TODO Compression
      default:
        throw new Error('bad block type')
    }

    return result
  }

  static async open(options: Options, file: FileHandle): Promise<SSTable> {
    const stat = await file.stat()
    if (stat.size < Footer.kEncodedLength) {
      throw new Error('file is too short to be an sstable')
    }
    const footerBuf = Buffer.alloc(Footer.kEncodedLength)
    await file.read(
      footerBuf,
      0,
      footerBuf.length,
      stat.size - Footer.kEncodedLength
    )
    const footer = new Footer(footerBuf)
    const indexBlockContents = await this.readBlock(
      file,
      new ReadOptions(),
      footer.indexHandle
    )
    const indexBlock = new DataBlock(indexBlockContents)
    indexBlock.blockType = 'indexblock'
    const table = new SSTable({
      file,
      options,
      indexBlock,
      metaIndexHandle: footer.metaIndexHandle,
    })
    await table.readMeta(footer)
    return table
  }

  constructor(rep: {
    file: FileHandle
    options: Options
    indexBlock: DataBlock
    metaIndexHandle: BlockHandle
  }) {
    this._file = rep.file
    this._options = rep.options
    this._indexBlock = rep.indexBlock
    this._cacheId = rep.options.blockCache.newId()
  }

  private _file: FileHandle
  private _cacheId: bigint
  private _options: Options
  private _indexBlock: DataBlock
  private _filterReader!: FilterBlock

  private async readMeta(footer: Footer): Promise<void> {
    if (!this._options.filterPolicy) {
      return // Do not need any metadata
    }
    const contents = await SSTable.readBlock(
      this._file,
      new ReadOptions(),
      footer.metaIndexHandle
    )
    const meta = new DataBlock(contents)
    meta.blockType = 'metaindexblock'
    const key = new Slice('filter.' + this._options.filterPolicy.name())
    for (const entry of meta.iterator(this._options.comparator)) {
      if (entry.key.isEqual(key)) {
        await this.readFilter(entry.value.buffer)
      }
    }
  }

  private async readFilter(filterHandleBuffer: Buffer): Promise<void> {
    const filterHandle = BlockHandle.from(filterHandleBuffer)

    const readOptions = new ReadOptions() // TODO
    const block = await SSTable.readBlock(this._file, readOptions, filterHandle)
    this._filterReader = new FilterBlock(this._options.filterPolicy, block.data)
  }

  // key: internalKey
  public async get(target: Slice): Promise<Status> {
    const targetInternalKey = InternalKey.from(target)

    for (const handleValue of this._indexBlock.iterator(
      this._options.comparator
    )) {
      const handle = BlockHandle.from(handleValue.value.buffer)

      if (
        !!this._filterReader &&
        !this._filterReader.keyMayMatch(handle.offset, target)
      ) {
        // Not found
      } else {
        for await (const entry of this.blockIterator(
          this,
          this._options,
          handle,
          'datablock'
        )) {
          const entryInternalKey = InternalKey.from(entry.key)
          if (
            entryInternalKey.userKey.isEqual(targetInternalKey.userKey) &&
            entryInternalKey.sequence <= targetInternalKey.sequence
          ) {
            // do not handle value type here, handle it at `Version.saveValue`
            return new Status(Promise.resolve(entry))
          }
        }
      }
    }
    return Status.createNotFound()
  }

  async *entryIterator(): AsyncIterableIterator<Entry> {
    for (const handleValue of this._indexBlock.iterator(
      this._options.comparator
    )) {
      const handle = BlockHandle.from(handleValue.value.buffer)
      yield* this.blockIterator(this, this._options, handle, 'datablock')
    }
  }

  // Convert an index iterator value (i.e., an encoded BlockHandle)
  // into an iterator over the contents of the corresponding block.
  async *blockIterator(
    table: SSTable,
    options: Options,
    handle: BlockHandle,
    blockType?: string
  ): AsyncIterableIterator<Entry> {
    const key = Buffer.concat([
      encodeFixed64(this._cacheId),
      encodeFixed64(handle.offset),
    ])

    let dataBlock = this._options.blockCache.get(key)
    if (!dataBlock) {
      const data = Buffer.alloc(handle.size)
      const { bytesRead } = await this._file.read(
        data,
        0,
        data.length,
        handle.offset
      )
      assert(bytesRead === data.length)

      const contents = {
        data: new Slice(data),
      } as BlockContents
      dataBlock = new DataBlock(contents)
      if (blockType) dataBlock.blockType = blockType
      this._options.blockCache.set(key, dataBlock)
    }
    yield* dataBlock.iterator(options.comparator)
  }
}
