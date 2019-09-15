/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @flow
/* global Generator */

import varint from 'varint'
import Buffer from 'buffer'
import Slice from './Slice'
import MemTable from './MemTable'
import LogRecord from './LogRecord'
import SequenceNumber from './SequenceNumber'
import { ValueType } from './Format'

export type AtomicUpdate = {
  type: ValueType,
  key: Slice,
  value: Slice
}

// Simplified WriteBatch
export default class WriteBatch {
  // WriteBatch header has an 8-byte sequence number followed by a 4-byte count.
  static kHeader = 8

  buffer:Buffer

  static insert (batch:WriteBatch, mem:MemTable) {
    const sn = WriteBatch.getSequence(batch)
    for (let update of batch.iterator()) {
      const { type, key, value } = update
      mem.add(sn, type, key, value)
    }
  }

  static setSequence (batch: WriteBatch, sequence:SequenceNumber) {
    batch.buffer.fill(sequence.toFixedSizeBuffer(WriteBatch.kHeader))
  }

  static getSequence (batch: WriteBatch):SequenceNumber {
    return varint.decode(batch.buffer)
  }

  constructor () {
    this.buffer = Buffer.alloc(WriteBatch.kHeader)
  }

  put (key:Slice, value:Slice) {
    const slice = LogRecord.add(key, value)
    this.buffer = Buffer.concat([this.buffer, slice.buffer])
  }

  del (key:Slice) {
    const slice = LogRecord.del(key)
    this.buffer = Buffer.concat([this.buffer, slice.buffer])
  }

  * iterator ():Generator<AtomicUpdate, void, void> {
    let index = 8
    while (index < this.buffer.length) {
      const valueType = ValueType.get(this.buffer.readUInt8(index))
      index++
      const keyLength = varint.decode(this.buffer, index)
      index += varint.decode.bytes
      const keyBuffer = this.buffer.slice(index, index + keyLength)
      index += keyLength

      if (valueType === ValueType.kTypeDeletion) {
        yield {
          type: valueType,
          key: new Slice(keyBuffer)
        }
        continue
      }

      const valueLength = varint.decode(this.buffer, index)
      index += varint.decode.bytes
      const valueBuffer = this.buffer.slice(index, index + valueLength)
      index += valueLength
      yield {
        type: valueType,
        key: new Slice(keyBuffer),
        value: new Slice(valueBuffer)
      }
    }
  }
}
