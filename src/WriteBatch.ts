/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert'
import varint from 'varint'
import { Buffer } from 'buffer'
import Slice from './Slice'
import MemTable from './MemTable'
import LogRecord from './LogRecord'
import { SequenceNumber, EntryRequireType, ValueType } from './Format'
import { decodeFixed64, encodeFixed32, decodeFixed32 } from './Coding'

// TODO should be separate to two class: WriteBatch and WriteBatchInternal

// Simplified WriteBatch
// WriteBatch::rep_ :=
//    sequence: fixed64
//    count: fixed32
//    data: record[count]
// record :=
//    kTypeValue varstring varstring         |
//    kTypeDeletion varstring
// varstring :=
//    len: varint32
//    data: uint8[len]
export default class WriteBatch {
  // WriteBatch header has an 8-byte sequence number followed by a 4-byte count.
  static kHeader = 12

  static insert(batch: WriteBatch, mem: MemTable): void {
    const sn = WriteBatch.getSequence(batch)
    for (const update of batch.iterator()) {
      const { type, key, value } = update
      mem.add(sn, type, key, value)
    }
  }

  static getContents(batch: WriteBatch): Buffer {
    return batch.buffer
  }

  static setContents(batch: WriteBatch, contents: Buffer): void {
    assert(contents.length >= WriteBatch.kHeader)
    batch.buffer = contents
  }

  static setSequence(batch: WriteBatch, sequence: number): void {
    batch.buffer.fill(new SequenceNumber(sequence).toFixed64Buffer(), 0, 7)
  }

  static getSequence(batch: WriteBatch): SequenceNumber {
    return new SequenceNumber(decodeFixed64(batch.buffer.slice(0, 8)))
  }

  static setCount(batch: WriteBatch, count: number): void {
    batch.buffer.fill(encodeFixed32(count), 8, 11)
  }

  static getCount(batch: WriteBatch): number {
    return decodeFixed32(batch.buffer.slice(8, 12))
  }

  get buffer(): Buffer {
    return this._buffer
  }

  set buffer(value: Buffer) {
    this._buffer = value
  }

  constructor() {
    this._buffer = Buffer.alloc(WriteBatch.kHeader)
  }

  private _buffer!: Buffer

  put(key: string | Buffer, value: string | Buffer): void {
    const record = LogRecord.add(new Slice(key), new Slice(value))
    this.buffer = Buffer.concat([this.buffer, record.buffer])
    WriteBatch.setCount(this, WriteBatch.getCount(this) + 1)
  }

  del(key: string | Buffer): void {
    const record = LogRecord.del(new Slice(key))
    this.buffer = Buffer.concat([this.buffer, record.buffer])
    WriteBatch.setCount(this, WriteBatch.getCount(this) + 1)
  }

  *iterator(): IterableIterator<EntryRequireType> {
    let index = WriteBatch.kHeader
    while (index < this.buffer.length) {
      const valueType = this.buffer.readUInt8(index)
      index++
      const keyLength = varint.decode(this.buffer, index)
      index += varint.decode.bytes
      const keyBuffer = this.buffer.slice(index, index + keyLength)
      index += keyLength

      if (valueType === ValueType.kTypeDeletion) {
        yield {
          type: valueType,
          key: new Slice(keyBuffer),
          value: new Slice(),
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
        value: new Slice(valueBuffer),
      }
    }
  }
}
