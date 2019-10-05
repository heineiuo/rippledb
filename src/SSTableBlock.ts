/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BlockContents } from './SSTableFormat'
import { Comparator } from './Comparator'
import { decodeFixed32 } from './Coding'
import { kSizeOfUint32, Entry } from './Format'
import Slice from './Slice'

interface RestartedEntry {
  entry: Entry
  shared: number
  nonShared: number
  rawSize: number
}

export default class SSTableBlock {
  constructor(contents: BlockContents) {
    this._buffer = contents.data.buffer
    this._size = contents.data.size
    const maxRestartsAllowed = (this._size - kSizeOfUint32) / kSizeOfUint32
    if (this.getNumRestarts() > maxRestartsAllowed) {
      this._size = 0
    } else {
      this._restartOffset =
        this._size - (1 + this.getNumRestarts()) * kSizeOfUint32
    }
  }

  public blockType!: string
  _restartOffset!: number
  _size: number
  _buffer: Buffer

  _restarts!: number[] // Restart points

  get buffer(): Buffer {
    return this._buffer
  }

  get size(): number {
    return this._size
  }

  getNumRestarts() {
    return decodeFixed32(this._buffer.slice(this._size - 4))
  }

  decodeEntry(offset: number, lastKey: Slice): RestartedEntry {
    const shared = decodeFixed32(this._buffer.slice(offset, offset + 4))
    const nonShared = decodeFixed32(this._buffer.slice(offset + 4, offset + 8))
    const keyLength = shared + nonShared
    const valueLength = decodeFixed32(this._buffer.slice(offset + 8))
    const sharedKey = lastKey.buffer.slice(0, shared)
    const nonSharedKey = this._buffer.slice(
      offset + 12,
      offset + 12 + nonShared
    )
    return {
      rawSize: 12 + nonShared + valueLength,
      shared,
      nonShared,
      entry: {
        key: new Slice(Buffer.concat([sharedKey, nonSharedKey])),
        value: new Slice(
          this._buffer.slice(
            offset + 12 + nonShared,
            offset + 12 + nonShared + valueLength
          )
        ),
      },
    } as RestartedEntry
  }

  *restartOffsetIterator(): IterableIterator<number> {
    // const numRestarts = this.getNumRestarts()
    let currentOffset = 0
    while (true) {
      yield currentOffset
      if (currentOffset >= this._size - 8) {
        break
      }
      currentOffset += 4
    }
  }

  *iterator(comparator: Comparator): IterableIterator<Entry> {
    // console.log(`block(${this.blockType}) iterator=`, this._buffer)
    const numRestarts = this.getNumRestarts()

    if (numRestarts === 0) {
      return
    }

    const lastRestartOffset = this._buffer.length - 8
    const restartOffsetIterator = this.restartOffsetIterator()
    // console.log(
    //   `block(${this.blockType}) iterator numRestarts=${numRestarts} this._size=${this._size} lastRestartOffset=${lastRestartOffset}`
    // )
    let restartOffsetResult = restartOffsetIterator.next()
    let offset = 0
    let lastKey = new Slice()
    let currentRestartOffset = restartOffsetResult.value
    if (!restartOffsetResult.done)
      restartOffsetResult = restartOffsetIterator.next()
    // console.log(
    //   `block(${this.blockType}) currentRestartOffset=${currentRestartOffset} restartOffsetResult.done=${restartOffsetResult.done} restartOffsetResult.value=${restartOffsetResult.value}`
    // )
    while (offset < lastRestartOffset) {
      if (offset === currentRestartOffset) {
        lastKey = new Slice()
      }
      const currentRestartedEntry = this.decodeEntry(offset, lastKey)

      yield currentRestartedEntry.entry
      lastKey = new Slice(currentRestartedEntry.entry.key)
      offset += currentRestartedEntry.rawSize
      if (offset === restartOffsetResult.value) {
        currentRestartOffset = restartOffsetResult.value
        restartOffsetResult = restartOffsetIterator.next()
      }
    }

    // let prevRestartOffset: number = -1
    // let currentRestartOffset: number = -1
    // let lastKey = new Slice()
    // for (let restartOffset of this.restartOffsetIterator()) {
    //   if (prevRestartOffset === -1) {
    //     prevRestartOffset = restartOffset
    //     continue
    //   }
    //   assert(restartOffset > 0)
    //   prevRestartOffset = restartOffset
    //   while (offset < restartOffset) {
    //     const currentRestartedEntry = this.decodeEntry(offset, lastKey)
    //     yield currentRestartedEntry
    //     lastKey = new Slice(currentRestartedEntry.key)
    //     offset += currentRestartedEntry.rawSize
    //   }
    // }

    // let index = 0
    // let restartOffsetIterator = this.restartOffsetIterator()
    // let currentRestartResult = restartOffsetIterator.next()
    // let prevRestartOffset = currentRestartResult.value
    // while (!currentRestartResult.done) {

    //   while(index < )
    // }
    // while (true) {}
    // let lastKey = this.decodeEntry(index)
    // index += lastKey.key.size + lastKey.value.size
    // const value = new Slice()

    // if (numRestarts === 0) {
    //   return
    // } else {
    //   let current: number = 0
    //   let recordSizeSummary: number = 0
    //   while (true) {
    //     if (this.size - 5 <= recordSizeSummary) {
    //       // console.log('SSTableBlock iterator done because offset is: ' + offset + ' and size is ' + this._size + ' and record.size is ' + record.size + ' and data is ' + JSON.stringify(data))
    //       return
    //     }
    //     const record = new SSTableRecord(
    //       this.buffer.slice(this.offset + recordSizeSummary)
    //     )
    //     if (record.isEmpty()) return
    //     const data = record.get()
    //     yield data
    //     // console.log('SSTableBlock iterator increase with offset ' + offset + ' and fixed-size ' + this._size + ' and record.size is ' + record.size)
    //     recordSizeSummary += record.size
    //   }
    // }
  }
}
