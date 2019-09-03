/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// @flow
/* global AsyncGenerator */

import assert from 'assert'
import fs from 'fs'
import varint from 'varint'
import { kBlockSize, ValueType, RecordType } from './Format'
import Slice from './Slice'
import LogRecord from './LogRecord'

class Log {
  static async * readIterator(filename: String): AsyncGenerator<any, void, void> {
    const fd = await fs.promises.open(filename, 'r')
    let buf: Buffer = Buffer.from(new ArrayBuffer(kBlockSize))
    let blockIndex = -1
    let latestOpBuf = Buffer.alloc(0)
    let latestType = null
    let bufHandledPosition = 0
    let currentBytesRead = 0
    while (true) {
      if (blockIndex === -1 || (bufHandledPosition >= kBlockSize - 7)) {
        const position = ++blockIndex * kBlockSize
        const { bytesRead } = await fd.read(buf, 0, kBlockSize, position)
        if (bytesRead === 0) return
        currentBytesRead = bytesRead
        bufHandledPosition = 0
        continue
      }

      // buf会被覆盖，所以需要拷贝
      const record = LogRecord.from(Buffer.from(buf.slice(bufHandledPosition)))
      bufHandledPosition += record.length
      if (record.type === RecordType.kFullType) {
        const op = new Slice(record.data.buffer)
        yield Log.parseOp(op)
      } else if (record.type === RecordType.kLastType) {
        assert(latestType !== RecordType.kLastType)
        latestOpBuf = Buffer.concat([latestOpBuf, record.data.buffer])
        const op = new Slice(latestOpBuf)
        latestOpBuf = Buffer.alloc(0)
        yield Log.parseOp(op)
      } else if (record.type === RecordType.kFirstType) {
        assert(latestType !== RecordType.kFirstType)
        latestOpBuf = record.data.buffer
      } else if (record.type === RecordType.kMiddleType) {
        latestOpBuf = Buffer.concat([latestOpBuf, record.data.buffer])
      } else if (record.type === RecordType.kZeroType) {
        latestType = record.type
        bufHandledPosition = kBlockSize
      }
      latestType = record.type
    }
  }

  static parseOp(op: Slice): { type: ValueType, key: Slice, value: Slice } {
    const valueType = ValueType.get(op.buffer.readUInt8(0))
    let index = 1
    const keyLength = varint.decode(op.buffer.slice(1))
    index += varint.decode.bytes
    const keyBuffer = op.buffer.slice(index, index + keyLength)
    index += keyLength

    if (valueType === ValueType.kTypeDeletion) {
      return {
        type: valueType,
        key: new Slice(keyBuffer)
      }
    }

    const valueLength = varint.decode(op.buffer.slice(index))
    index += varint.decode.bytes
    const valueBuffer = op.buffer.slice(index, index + valueLength)
    return {
      type: valueType,
      key: new Slice(keyBuffer),
      value: new Slice(valueBuffer)
    }
  }

  constructor(filename: string) {
    this._filename = filename // path.resolve(dbpath, './LOG')
    this._currentBlockSize = 0
  }

  _file: {
    [x: string]: any
  }
  _filename: string
  _currentBlockSize: number

  async add(key: Slice, value: Slice) {
    await this.addRecord(new Slice(Buffer.concat([
      Buffer.from([ValueType.kTypeValue.value]),
      Buffer.from(varint.encode(key.length)),
      key.buffer,
      Buffer.from(varint.encode(value.length)),
      value.buffer
    ])))
  }

  async del(key: Slice) {
    await this.addRecord(new Slice(Buffer.concat([
      Buffer.from([ValueType.kTypeDeletion.value]),
      Buffer.from(varint.encode(key.length)),
      key.buffer
    ])))
  }

  async appendFile(buf: Buffer) {
    if (!this._file) {
      this._file = await fs.promises.open(this._filename, 'a+')
    }
    await this._file.appendFile(buf)
  }

  async close() {
    await this._file.close()
  }

  /**
   * record op: type(ValueType, 1B) | key_length (varint32) | key | value_length(varint32) | value
   */
  async addRecord(recordOp: Slice) {
    if (this._currentBlockSize + 7 + recordOp.length <= kBlockSize) {
      // 不需要分割
      const record = new LogRecord(RecordType.kFullType, recordOp)
      this._currentBlockSize += record.length
      await this.appendFile(record.buffer)
      console.log(`Finish a record with kFullType, currentblockSize=${this._currentBlockSize}`)
    } else {
      let currentRecordOpPosition = 0
      let hasFirstRecordCreated = false
      while (true) {
        const currentFreeSpace = kBlockSize - this._currentBlockSize
        if (currentFreeSpace <= 7) {
          const padBuf = Buffer.alloc(currentFreeSpace)
          console.log(`currentFreeSpace <= 7 currentFreeSpace=${currentFreeSpace}, padBuf.length=${padBuf.length}`)
          assert(padBuf.length <= 7)
          await this.appendFile(padBuf)
          this._currentBlockSize = 0
          continue
        }

        const startPosition = currentRecordOpPosition
        const remainOp = recordOp.size - currentRecordOpPosition
        const currentRecordSize = Math.min(currentFreeSpace - 7, recordOp.size - currentRecordOpPosition) + 7
        currentRecordOpPosition += currentRecordSize - 7

        let recordType: RecordType
        if (!hasFirstRecordCreated) {
          // currentRecordSize >= currentFreeSpace
          recordType = RecordType.kFirstType
          hasFirstRecordCreated = true
          assert(this._currentBlockSize + currentRecordSize === kBlockSize)
          this._currentBlockSize = 0
        } else if (remainOp + 7 <= currentFreeSpace) {
          recordType = RecordType.kLastType
          this._currentBlockSize += currentRecordSize

          // console.log('RecordType.kLastType currentRecordSize is ', currentRecordOpPosition - startPosition + 7)
          // console.log('RecordType.kLastType after, currentBlockSize is', this._currentBlockSize + currentRecordOpPosition - startPosition + 7)
        } else {
          assert(this._currentBlockSize + currentRecordSize === kBlockSize)
          this._currentBlockSize = 0
          recordType = RecordType.kMiddleType
        }

        const record = new LogRecord(recordType, new Slice(recordOp.buffer.slice(startPosition, currentRecordOpPosition)))
        assert(record.length === currentRecordSize)
        await this.appendFile(record.buffer)
        // console.log(`append a record with ${recordType.key}, startPosition=${startPosition} currentRecordOpPosition=${currentRecordOpPosition} currentRecordSize=${currentRecordSize} currentblockSize=${this._currentBlockSize}`)
        if (recordType === RecordType.kLastType) {
          break
        }
      }
    }
  }
}

export default Log
