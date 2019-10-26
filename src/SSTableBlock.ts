/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Comparator } from './Comparator'
import { decodeFixed32 } from './Coding'
import { BlockContents, kSizeOfUInt32, Entry } from './Format'
import Slice from './Slice'
import assert from 'assert'
import { Buffer } from 'buffer'

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
    const maxRestartsAllowed = (this._size - kSizeOfUInt32) / kSizeOfUInt32
    if (this.getNumRestarts() > maxRestartsAllowed) {
      // The size is too small for NumRestarts()
      this._size = 0
    } else {
      this._restartPoint =
        this._size - (1 + this.getNumRestarts()) * kSizeOfUInt32
    }
  }

  public blockType!: string

  private _restartPoint!: number
  private _size: number
  private _buffer: Buffer

  get buffer(): Buffer {
    return this._buffer
  }

  get size(): number {
    return this._size
  }

  getNumRestarts(): number {
    return decodeFixed32(this._buffer.slice(this._size - 4))
  }

  decodeEntry(offset: number, lastKey: Slice): RestartedEntry {
    const shared = decodeFixed32(this._buffer.slice(offset, offset + 4))
    const nonShared = decodeFixed32(this._buffer.slice(offset + 4, offset + 8))
    const valueLength = decodeFixed32(
      this._buffer.slice(offset + 8, offset + 12)
    )
    const keyLength = shared + nonShared
    const nonSharedKey = this._buffer.slice(
      offset + 12,
      offset + 12 + nonShared
    )
    const sharedKey = lastKey.buffer.slice(0, shared)
    const key = new Slice(Buffer.concat([sharedKey, nonSharedKey]))
    assert(key.length === keyLength)
    return {
      rawSize: 12 + nonShared + valueLength,
      shared,
      nonShared,
      entry: {
        key,
        value: new Slice(
          this._buffer.slice(
            offset + 12 + nonShared,
            offset + 12 + nonShared + valueLength
          )
        ),
      },
    } as RestartedEntry
  }

  *restartPointIterator(): IterableIterator<number> {
    let currentOffset = this._restartPoint
    while (true) {
      if (currentOffset >= this._size - 4) {
        break
      }
      yield decodeFixed32(this._buffer.slice(currentOffset, currentOffset + 4))
      currentOffset += 4
    }
  }

  // eslint-disable-next-line
  *iterator(comparator: Comparator): IterableIterator<Entry> {
    const numRestarts = this.getNumRestarts()
    if (numRestarts === 0) {
      return
    }

    const restartPointIterator = this.restartPointIterator()

    let offset = 0
    let lastKey = new Slice()
    let currentRestartPointResult = restartPointIterator.next()
    let currentRestartPoint = currentRestartPointResult.value

    while (true) {
      if (offset >= this._restartPoint) break

      const currentRestartedEntry = this.decodeEntry(offset, lastKey)
      yield currentRestartedEntry.entry
      lastKey = new Slice(currentRestartedEntry.entry.key)
      offset += currentRestartedEntry.rawSize

      if (offset === currentRestartPoint) {
        lastKey = new Slice()
        currentRestartPointResult = restartPointIterator.next()
        currentRestartPoint = currentRestartPointResult.value
      }
    }
  }
}
