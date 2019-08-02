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
import SSTableFooter from './SSTableFooter'
import SSTableIndexBlock from './SSTableIndexBlock'
import SSTableMetaIndexBlock from './SSTableMetaIndexBlock'
import SSTableMetaBlock from './SSTableMetaBlock'
import SSTableDataBlock from './SSTableDataBlock'
import Comparator from './Comparator'

interface FileHandle extends fs.FileHandle{}

export default class SSTableBuilder {
  constructor (file:FileHandle, options:{size:number} = {}) {
    this._file = file
    this._dataBlockSize = 0
    this._lastKey = Buffer.from('0')
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

  _options: {size:number}
  _file:FileHandle
  _name:string
  _lastKey:Buffer
  _dataBlockSize:number
  _dataBlock:SSTableDataBlock
  _metaBlock:SSTableMetaBlock
  _metaIndexBlock:SSTableMetaIndexBlock
  _indexBlock:SSTableIndexBlock
  _footer:SSTableFooter

  async add (key:string|Buffer, value: string|Buffer) {
    assert(Buffer.from(key).compare(this._lastKey) > 0, `${key} must bigger then ${this._lastKey.toString()}`)
    this._lastKey = Buffer.from(key)
    this._dataBlock.append({ key, value })
    if (this._dataBlock.estimateSize > this._options.size) {
      await this.flush()
    }
  }

  async flush () {
    // console.log('SSTableBuilder flush', this._dataBlock._buffer)
    let lastDataBlockSize = this._dataBlockSize
    this._dataBlockSize += this._dataBlock.size
    await this._file.appendFile(this._dataBlock.buffer)
    this._indexBlock.append({
      key: this._lastKey,
      value: Buffer.concat([
        Buffer.from(varint.encode(lastDataBlockSize)),
        Buffer.from(varint.encode(this._dataBlockSize))
      ])
    })
    this._dataBlock = new SSTableDataBlock()
  }

  async close () {
    await this.flush()
    this._file.appendFile(this._metaBlock.buffer)
    this._file.appendFile(this._metaIndexBlock.buffer)
    this._file.appendFile(this._indexBlock.buffer)
    this._file.appendFile(this._footer.buffer)
    await this._file.close()
  }
}
