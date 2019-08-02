/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { promises as fs } from 'fs'
import { Buffer } from 'buffer'
import assert from 'assert'
import varint from 'varint'
import BloomFilter from './BloomFilter'
import SSTableFooter from './SSTableFooter'
import SSTableIndexBlock from './SSTableIndexBlock'
import SSTableMetaIndexBlock from './SSTableMetaIndexBlock'
import SSTableMetaBlock from './SSTableMetaBlock'
import SSTableDataBlock from './SSTableDataBlock'
import Comparator from './Comparator'

interface FileHandle extends fs.FileHandle { }

export default class SSTableBuilder {
  constructor(file: FileHandle, options: { size: number } = {}) {
    this._file = file
    this._fileSize = 0
    this._dataBlockSize = 0
    this._comparator = new Comparator()
    this._dataBlock = new SSTableDataBlock()
    this._metaBlock = new SSTableMetaBlock()
    this._metaIndexBlock = new SSTableMetaIndexBlock()
    this._indexBlock = new SSTableIndexBlock()
    this._footer = new SSTableFooter()
    this._options = options
    if (!this._options.size) {
      this._options.size = 2 << 11
    }
  }

  _options: { size: number }
  _file: FileHandle
  _fileSize: number
  _name: string
  _lastKey: void | Buffer
  _dataBlockSize: number
  _dataBlock: SSTableDataBlock
  _metaBlock: SSTableMetaBlock
  _metaIndexBlock: SSTableMetaIndexBlock
  _indexBlock: SSTableIndexBlock
  _footer: SSTableFooter

  async add(key: string | Buffer, value: string | Buffer) {
    if (this._lastKey) {
      assert(Buffer.from(key).compare(this._lastKey) > 0, `${key} must bigger then ${this._lastKey.toString()}`)
    }
    this._lastKey = Buffer.from(key)
    this._dataBlock.append({ key, value })
    if (this._dataBlock.estimateSize > this._options.size) {
      await this.flush()
    }
  }

  async flush() {
    const lastDataBlockSize = this._dataBlockSize
    this._dataBlockSize += this._dataBlock.size
    await this.appendFile(this._dataBlock.buffer)
    this._indexBlock.append({
      key: this._lastKey,
      value: Buffer.concat([
        Buffer.from(varint.encode(lastDataBlockSize)),
        Buffer.from(varint.encode(this._dataBlockSize))
      ])
    })
    const keys = []
    const blockKeyIterator = this._dataBlock.iterator()
    let result = blockKeyIterator.next()
    while (!result.done) {
      keys.push(result.value.key)
      result = blockKeyIterator.next()
    }

    const filter = new BloomFilter()
    filter.putKeys(keys, keys.length)
    this._metaBlock.appendFilter(filter.buffer)
    this._dataBlock = new SSTableDataBlock()
  }

  async appendFile(buffer: Buffer) {
    await this._file.appendFile(buffer)
    this._fileSize += buffer.length
  }

  async close() {
    if (this._dataBlock.size > 0) {
      await this.flush()
    }
    await this.appendFile(this._metaBlock.buffer)
    this._metaIndexBlock.append({
      key: this._metaIndexBlock.filterKey,
      value: Buffer.concat([
        // offset
        Buffer.from(varint.encode(this._fileSize)),
        // size
        Buffer.from(varint.encode(this._metaBlock.size))
      ])
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
      indexSize: indexSize
    })
    await this.appendFile(this._footer.buffer)
    await this._file.close()
  }
}
