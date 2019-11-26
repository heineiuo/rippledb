/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert'
import varint from 'varint'
import Slice from './Slice'
import MemTable from './MemTable'
import LogRecord from './LogRecord'
import { SequenceNumber, EntryRequireType, ValueType } from './Format'
import { decodeFixed64, encodeFixed32, decodeFixed32 } from './Coding'

export class WriteBatchInternal {
  // WriteBatch header has an 8-byte sequence number followed by a 4-byte count.
  static kHeader = 12

  static byteSize(batch: WriteBatch): number {
    return batch.buffers.reduce((size, buf) => size + buf.length, 0)
  }

  static insert(batch: WriteBatch, mem: MemTable): void {
    const nextSequence = WriteBatchInternal.getSequence(batch)
    for (const update of batch.iterator()) {
      const { type, key, value } = update
      mem.add(nextSequence, type, key, value)
      nextSequence.value += 1
    }
  }

  static getContents(batch: WriteBatch): Buffer {
    return Buffer.concat([batch.head, ...batch.buffers])
  }

  static setContents(batch: WriteBatch, contents: Buffer): void {
    assert(contents.length >= WriteBatchInternal.kHeader)
    batch.head = contents.slice(0, this.kHeader)
    batch.buffers = [contents.slice(this.kHeader)]
  }

  // sequence must be lastSequence + 1
  static setSequence(batch: WriteBatch, sequence: number): void {
    batch.head.fill(new SequenceNumber(sequence).toFixed64Buffer(), 0, 7)
  }

  static getSequence(batch: WriteBatch): SequenceNumber {
    return new SequenceNumber(decodeFixed64(batch.head.slice(0, 8)))
  }

  static setCount(batch: WriteBatch, count: number): void {
    batch.head.fill(encodeFixed32(count), 8, 11)
  }

  static getCount(batch: WriteBatch): number {
    return decodeFixed32(batch.head.slice(8, 12))
  }

  static append(dst: WriteBatch, src: WriteBatch): void {
    WriteBatchInternal.setCount(
      dst,
      WriteBatchInternal.getCount(src) + WriteBatchInternal.getCount(dst)
    )
    // for (const buf of src.buffers) {
    //   dst.buffers.push(buf)
    // }
    dst.buffers = dst.buffers.concat(src.buffers)
  }
}

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
export class WriteBatch {
  buffers: Buffer[] = []
  head: Buffer = Buffer.alloc(WriteBatchInternal.kHeader)

  put(key: string | Buffer, value: string | Buffer): void {
    const record = LogRecord.add(new Slice(key), new Slice(value))
    this.buffers.push(record.buffer)
    WriteBatchInternal.setCount(this, WriteBatchInternal.getCount(this) + 1)
  }

  del(key: string | Buffer): void {
    const record = LogRecord.del(new Slice(key))
    this.buffers.push(record.buffer)
    WriteBatchInternal.setCount(this, WriteBatchInternal.getCount(this) + 1)
  }

  clear(): void {
    this.buffers = []
    this.head = Buffer.alloc(WriteBatchInternal.kHeader)
  }

  *iterator(): IterableIterator<EntryRequireType> {
    let buffersIndex = 0
    const buffersCount = this.buffers.length
    while (buffersIndex < buffersCount) {
      const buffer = this.buffers[buffersIndex]
      const bufferLength = buffer.length
      let index = 0

      while (index < bufferLength) {
        const valueType = buffer.readUInt8(index)
        index++
        const keyLength = varint.decode(buffer, index)
        index += varint.decode.bytes
        const keyBuffer = buffer.slice(index, index + keyLength)
        index += keyLength

        if (valueType === ValueType.kTypeDeletion) {
          yield {
            type: valueType,
            key: new Slice(keyBuffer),
            value: new Slice(),
          }
          continue
        }

        const valueLength = varint.decode(buffer, index)
        index += varint.decode.bytes
        const valueBuffer = buffer.slice(index, index + valueLength)
        index += valueLength
        yield {
          type: valueType,
          key: new Slice(keyBuffer),
          value: new Slice(valueBuffer),
        }
      }
      buffersIndex++
    }
  }
}
