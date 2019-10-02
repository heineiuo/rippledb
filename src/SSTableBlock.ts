/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import SSTableRecord from './SSTableRecord'
import { Entry } from './VersionFormat'
import { BlockContents } from './SSTableFormat'
import { Comparator } from './Comparator'
import { decodeFixed32 } from './Coding'

export default class SSTableBlock {
  static *createIter(): IterableIterator<Entry> { }

  constructor(contents: BlockContents) {
    this._buffer = contents.data.buffer
    this._size = contents.data.size
  }

  _size: number
  _offset!: number
  _buffer: Buffer

  _restarts!: number[] // Restart points

  get buffer(): Buffer {
    return this._buffer
  }

  get size(): number {
    return this._size
  }

  get offset(): number {
    return this._offset
  }

  getNumRestarts() {
    return decodeFixed32(this._buffer.slice(this._size - 4))
  }

  *iterator(comparator: Comparator): IterableIterator<Entry> {
    if (this.size <= 5) throw new Error('bad block contents')
    let recordSizeSummary: number = 0
    const numRestarts = this.getNumRestarts()

    while (true) {
      if (this.size - 5 <= recordSizeSummary) {
        // console.log('SSTableBlock iterator done because offset is: ' + offset + ' and size is ' + this._size + ' and record.size is ' + record.size + ' and data is ' + JSON.stringify(data))
        return
      }
      const record = new SSTableRecord(
        this.buffer.slice(this.offset + recordSizeSummary)
      )
      if (record.isEmpty()) return
      const data = record.get()
      yield data
      // console.log('SSTableBlock iterator increase with offset ' + offset + ' and fixed-size ' + this._size + ' and record.size is ' + record.size)
      recordSizeSummary += record.size
    }
  }

}
