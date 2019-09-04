/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// @flow

import crc32 from 'buffer-crc32'
import assert from 'assert'
import varint from 'varint'
import Slice from './Slice'
import { RecordType, VersionEditTag } from './Format'
import { createHexStringFromDecimal } from './LevelUtils'

export default class ManifestRecord {
  static from (buf:Buffer):ManifestRecord {
    const length = buf.readUInt16BE(4)
    const type = RecordType.get(buf.readUInt8(6))
    const data = new Slice(buf.slice(7, 7 + length))
    assert(length === data.length)
    const record = new ManifestRecord(type, data)
    return record
  }

  static addComparator (comparatorName:Slice) {
    return new Slice(Buffer.concat([
      Buffer.from([VersionEditTag.kComparator.value]),
      Buffer.from(varint.encode(comparatorName.length)),
      comparatorName.buffer
    ]))
  }

  static addLogNumber (logNumber:number) {
    return new Slice(Buffer.concat([
      Buffer.from([VersionEditTag.kLogNumber.value]),
      Buffer.from(varint.encode(logNumber))
    ]))
  }

  static addPrevLogNumber (logNumber:number) {
    return new Slice(Buffer.concat([
      Buffer.from([VersionEditTag.kPrevLogNumber.value]),
      Buffer.from(varint.encode(logNumber))
    ]))
  }

  static addNextLogNumber (logNumber:number) {
    return new Slice(Buffer.concat([
      Buffer.from([VersionEditTag.kNextLogNumber.value]),
      Buffer.from(varint.encode(logNumber))
    ]))
  }

  static addLastSequence (sequenceNumber:number) {
    return new Slice(Buffer.concat([
      Buffer.from([VersionEditTag.kLastSequence.value]),
      Buffer.from(varint.encode(sequenceNumber))
    ]))
  }

  static addCompactPointer (level:number, internalKey:Slice) {
    return new Slice(Buffer.concat([
      Buffer.from([VersionEditTag.kCompactPointer.value]),
      Buffer.from(varint.encode(level)),
      Buffer.from(varint.encode(internalKey.length)),
      internalKey.buffer
    ]))
  }

  static addDeletedFile (level:number, fileNum:number) {
    return new Slice(Buffer.concat([
      Buffer.from([VersionEditTag.kDeletedFile.value]),
      Buffer.from(varint.encode(level)),
      Buffer.from(varint.encode(fileNum))
    ]))
  }

  static addNewFile (level:number, fileNum:number, fileSize:number, smallestKey:Slice, largestKey:Slice) {
    return new Slice(Buffer.concat([
      Buffer.from([VersionEditTag.kNewFile.value]),
      Buffer.from(varint.encode(level)),
      Buffer.from(varint.encode(fileNum)),
      Buffer.from(varint.encode(fileSize)),
      Buffer.from(varint.encode(smallestKey.length)),
      smallestKey.buffer,
      Buffer.from(varint.encode(largestKey.length)),
      largestKey.buffer
    ]))
  }

  static parseOp (op: Slice): { type: VersionEditTag, key: Slice, value: Slice } {
    const type = VersionEditTag.get(op.buffer.readUInt8(0))
    let index = 1

    if (type === VersionEditTag.kComparator) {
      const comparatorNameLength = varint.decode(op.buffer.slice(1))
      index += varint.decode.bytes
      const comparatorName = op.buffer.slice(index, index + comparatorNameLength)
      index += comparatorNameLength

      return {
        type,
        comparatorName: comparatorName.toString()
      }
    } else if (type === VersionEditTag.kLogNumber) {
      const logNumber = varint.decode(op.buffer.slice(1))
      return {
        type,
        logNumber
      }
    } else if (type === VersionEditTag.kPrevLogNumber) {
      const prevLogNumber = varint.decode(op.buffer.slice(1))
      return {
        type,
        prevLogNumber
      }
    } else if (type === VersionEditTag.kNextLogNumber) {
      const nextLogNumber = varint.decode(op.buffer.slice(1))
      return {
        type,
        nextLogNumber
      }
    } else if (type === VersionEditTag.kLastSequence) {
      const lastSequence = varint.decode(op.buffer.slice(1))
      return {
        type,
        lastSequence
      }
    } else if (type === VersionEditTag.kCompactPointer) {
      const level = varint.decode(op.buffer.slice(1))
      index += varint.decode.bytes
      const internalKeyLength = varint.decode(op.buffer.slice(index))
      index += varint.decode.bytes
      const internalKey = op.buffer.slice(index, index + internalKeyLength)
      return {
        type,
        level,
        internalKey
      }
    } else if (type === VersionEditTag.kDeletedFile) {
      const level = varint.decode(op.buffer.slice(1))
      index += varint.decode.bytes
      const fileNum = varint.decode(op.buffer.slice(index))
      return {
        type,
        level,
        fileNum
      }
    } else if (type === VersionEditTag.kNewFile) {
      const level = varint.decode(op.buffer.slice(1))
      index += varint.decode.bytes
      const fileNum = varint.decode(op.buffer.slice(index))
      index += varint.decode.bytes
      const fileSize = varint.decode(op.buffer.slice(index))
      index += varint.decode.bytes
      const smallestKeyLength = varint.decode(op.buffer.slice(index))
      index += varint.decode.bytes
      const smallestKey = op.buffer.slice(index, index + smallestKeyLength)
      index += smallestKeyLength
      const largestKeyLength = varint.decode(op.buffer.slice(index))
      index += varint.decode.bytes
      const largestKey = op.buffer.slice(index, index + largestKeyLength)

      return {
        type,
        level,
        fileNum,
        fileSize,
        smallestKey,
        largestKey
      }
    }
  }

  constructor (type:RecordType, data:Slice | Buffer) {
    this.type = type
    this.data = new Slice(data)
  }

  get length () {
    return this.data.length + 7
  }

  get size () {
    return this.length
  }

  data:Slice
  type:VersionEditTag

  get buffer ():Buffer {
    const lengthBuf = Buffer.from(createHexStringFromDecimal(this.data.length), 'hex')
    const typeBuf = Buffer.from([this.type.value])
    const sum = crc32(Buffer.concat([typeBuf, this.data.buffer]))
    return Buffer.concat([
      sum,
      lengthBuf,
      typeBuf,
      this.data.buffer
    ])
  }
}
