/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Buffer } from 'buffer'
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
  ValueType,
} from './Format'
import Status from './Status'
import { Options, ReadOptions } from './Options'

// Reader
export default class SSTable {
  static async readBlock(
    buf: Buffer,
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
    const data = buf.slice(
      handle.offset,
      handle.offset + handle.size + kBlockTrailerSize
    )
    if (data.length !== handle.size + kBlockTrailerSize) {
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

  static async open(options: Options, fileHandle: FileHandle) {
    const buf = await fileHandle.readFile()
    if (buf.length < Footer.kEncodedLength) {
      throw new Error('file is too short to be an sstable')
    }
    const footer = new Footer(buf.slice(buf.length - Footer.kEncodedLength))

    // console.log(`footer.indexHandle=${JSON.stringify(footer.indexHandle)}`)
    const indexBlockContents = await this.readBlock(
      buf,
      new ReadOptions(),
      footer.indexHandle
    )
    const indexBlock = new DataBlock(indexBlockContents)
    indexBlock.blockType = 'indexblock'
    const table = new SSTable({
      options,
      indexBlock,
      buf,
      metaIndexHandle: footer.metaIndexHandle,
    })
    await table.readMeta(footer)
    return table
  }

  constructor(rep: {
    buf: Buffer
    options: Options
    indexBlock: DataBlock
    metaIndexHandle: BlockHandle
  }) {
    this._options = rep.options
    this._buffer = rep.buf
    this._metaIndexHandle = rep.metaIndexHandle
    this._indexBlock = rep.indexBlock
  }

  private _buffer: Buffer
  private _options: Options
  private _metaIndexHandle: BlockHandle
  private _indexBlock: DataBlock
  private _dataBlock!: DataBlock
  private _filterBuffer!: Buffer
  private _filterReader!: FilterBlock

  private async readMeta(footer: Footer) {
    if (!this._options.filterPolicy) {
      return // Do not need any metadata
    }
    const contents = await SSTable.readBlock(
      this._buffer,
      new ReadOptions(),
      footer.metaIndexHandle
    )
    const meta = new DataBlock(contents)
    meta.blockType = 'metaindexblock'
    const key = new Slice('filter.' + this._options.filterPolicy.name())
    for (let entry of meta.iterator(this._options.comparator)) {
      if (entry.key.isEqual(key)) {
        await this.readFilter(entry.value.buffer)
      }
    }
  }

  private async readFilter(filterHandleBuffer: Buffer) {
    const filterHandle = BlockHandle.from(filterHandleBuffer)

    const readOptions = new ReadOptions() // TODO
    const block = await SSTable.readBlock(
      this._buffer,
      readOptions,
      filterHandle
    )
    this._filterBuffer = block.data.buffer
    this._filterReader = new FilterBlock(this._options.filterPolicy, block.data)
  }

  // key: internalkey
  public async get(target: Slice): Promise<Status> {
    const targetInternalKey = InternalKey.from(target)

    for (let handleValue of this._indexBlock.iterator(
      this._options.comparator
    )) {
      // console.log(`sstable.get start`)
      const handle = BlockHandle.from(handleValue.value.buffer)
      // console.log(`sstable.get handleValue=`, handleValue.value)
      // console.log(`sstable.get indexBlock handle=${JSON.stringify(handle)}`)

      if (
        !!this._filterReader &&
        !this._filterReader.keyMayMatch(handle.offset, target)
      ) {
        // Not found
        console.log(
          `not found... because ${
            !this._filterReader ? 'no filter reader' : 'keyNotMatch'
          }`
        )
      } else {
        for (let entry of this.blockIterator(
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
            if (entryInternalKey.type === ValueType.kTypeValue) {
              return new Status(Promise.resolve(entry))
            }
            break
          }
        }
        break
      }
    }
    return Status.createNotFound()
  }

  // Convert an index iterator value (i.e., an encoded BlockHandle)
  // into an iterator over the contents of the corresponding block.
  *blockIterator(
    table: SSTable,
    options: Options,
    handle: BlockHandle,
    blockType?: string
  ): IterableIterator<Entry> {
    const contents = {
      data: new Slice(
        this._buffer.slice(handle.offset, handle.offset + handle.size)
      ),
    } as BlockContents
    const dataBlock = new DataBlock(contents)
    if (blockType) dataBlock.blockType = blockType
    yield* dataBlock.iterator(options.comparator)
  }
}
