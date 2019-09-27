/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
//@flow

import fs from 'fs'
import { Buffer } from 'buffer'
import assert from 'assert'
import varint from 'varint'
import Slice from './Slice'
import BloomFilter from './BloomFilter'
import SSTableFooter from './SSTableFooter'
import SSTableIndexBlock from './SSTableIndexBlock'
import SSTableMetaIndexBlock from './SSTableMetaIndexBlock'
import SSTableMetaBlock from './SSTableMetaBlock'
import SSTableDataBlock from './SSTableDataBlock'

export default class SSTableBuilder {
  constructor(
    file: fs.promises.FileHandle,
    options: { size: number } = { size: 2 << 11 }
  ) {
    this._file = file
    this._fileSize = 0
    this._totalDataBlockSize = 0
    this._dataBlock = new SSTableDataBlock()
    this._metaBlock = new SSTableMetaBlock()
    this._metaIndexBlock = new SSTableMetaIndexBlock()
    this._indexBlock = new SSTableIndexBlock()
    this._footer = new SSTableFooter()
    this._flushTimes = 0
    this._options = options
  }

  private _options: { size: number }
  private _file: fs.promises.FileHandle
  private _fileSize: number
  private _flushTimes: number
  private _name!: string
  private _lastKey!: Slice
  private _totalDataBlockSize: number
  private _dataBlock: SSTableDataBlock
  private _metaBlock: SSTableMetaBlock
  private _metaIndexBlock: SSTableMetaIndexBlock
  private _indexBlock: SSTableIndexBlock
  private _footer: SSTableFooter
  private _numEntries!: number

  async add(key: Slice, value: Slice) {
    if (this._lastKey) {
      assert(
        key.compare(this._lastKey) > 0,
        `new key must bigger then last key`
      )
    }
    this._lastKey = new Slice(key)
    this._dataBlock.append({ key, value })
    if (this._dataBlock.estimateSize > this._options.size) {
      await this.flush()
    }
  }

  async flush() {
    this._flushTimes++
    const lastDataBlockSize = this._totalDataBlockSize
    this._totalDataBlockSize += this._dataBlock.size
    await this.appendFile(this._dataBlock.buffer)
    this._indexBlock.append({
      key: this._lastKey,
      value: new Slice(
        Buffer.concat([
          Buffer.from(varint.encode(lastDataBlockSize)),
          Buffer.from(varint.encode(this._dataBlock.size)),
        ])
      ),
    })
    const keys = []
    for (let result of this._dataBlock.iterator()) {
      keys.push(result.key.toString())
    }

    const filter = new BloomFilter()
    filter.putKeys(keys, keys.length)
    this._metaBlock.appendFilter(filter.buffer)
    this._dataBlock = new SSTableDataBlock()
  }

  async appendFile(buffer: Buffer) {
    await this._file.appendFile(buffer, { encoding: 'buffer' })
    this._fileSize += buffer.length
  }

  async close() {
    if (this._dataBlock.size > 0) {
      await this.flush()
    }
    await this.appendFile(this._metaBlock.buffer)
    this._metaIndexBlock.append({
      key: new Slice(this._metaIndexBlock.filterKey),
      value: new Slice(
        Buffer.concat([
          // offset
          Buffer.from(varint.encode(this._fileSize)),
          // size
          Buffer.from(varint.encode(this._metaBlock.size)),
        ])
      ),
    })
    const metaIndexOffset = this._fileSize
    await this.appendFile(this._metaIndexBlock.buffer)
    const metaIndexSize = this._fileSize - metaIndexOffset
    const indexOffset = this._fileSize
    const indexSize = this._indexBlock.size
    await this.appendFile(this._indexBlock.buffer)
    this._footer.put({
      metaIndexOffset: metaIndexOffset,
      metaIndexSize: metaIndexSize,
      indexOffset: indexOffset,
      indexSize: indexSize,
    })
    await this.appendFile(this._footer.buffer)
    await this._file.close()
    // console.log(`SSTable flush times: ${this._flushTimes}`)
  }
}
