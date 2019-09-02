/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// @flow
/* global AsyncGenerator */

import fs from 'fs'
import varint from 'varint'
import { kBlockSize, ValueType, RecordType } from './Format'
import Slice from './Slice'
import LogRecord from './LogRecord'

class Log {
  static async * readIterator (filename: String):AsyncGenerator<any, void, void> {
    const buf = await fs.promises.readFile(filename)
    console.log('Log.readLogRecord buf length', buf.length)
  }

  constructor (filename:string) {
    this._filename = filename // path.resolve(dbpath, './LOG')
    this._currentBlockSize = 0
  }

  _file: {
    [x:string]:any
  }
  _filename:string
  _currentBlockSize: number

  async readLogRecord (initialOffset:number) {
  }

  async add (key:Slice, value:Slice) {
    await this.addRecord(new Slice(Buffer.concat([
      Buffer.from([ValueType.kTypeValue.value]),
      Buffer.from(varint.encode(key.length)),
      key.buffer,
      Buffer.from(varint.encode(value.length)),
      value.buffer
    ])))
  }

  async del (key:Slice) {
    await this.addRecord(new Slice(Buffer.concat([
      Buffer.from([ValueType.kTypeDeletion]),
      Buffer.from(varint.encode(key.length)),
      key.buffer
    ])))
  }

  async appendFile (buf:Buffer) {
    if (!this._file) {
      this._file = await fs.promises.open(this._filename, 'a+')
    }
    await this._file.appendFile(buf)
  }

  async close () {
    await this._file.close()
  }

  /**
   * record op: type(ValueType, 1B) | key_length (varint32) | key | value_length(varint32) | value
   */
  async addRecord (recordOp: Slice) {
    if (this._currentBlockSize + recordOp.length + 7 <= kBlockSize) {
      const record = new LogRecord(RecordType.kFullType, recordOp)
      this._currentBlockSize += record.length
      await this.appendFile(record.buffer)
    } else {
      let position = 0
      let hasFirstRecordCreated = false
      while (position < recordOp.size) {
        const currentBlockLeftSpace = kBlockSize - this._currentBlockSize - 7
        const startPosition = position
        if (!hasFirstRecordCreated) {
          const recordType = RecordType.kFirstType
          position += currentBlockLeftSpace
          const record = new LogRecord(recordType, new Slice(recordOp.buffer.slice(startPosition, position)))
          this._currentBlockSize = 0
          await this.appendFile(record.buffer)
          hasFirstRecordCreated = true
        } else if (currentBlockLeftSpace > recordOp.size - position) {
          const recordType = RecordType.kLastType
          position = recordOp.size
          const record = new LogRecord(recordType, new Slice(recordOp.buffer.slice(startPosition, position)))
          this._currentBlockSize += record.length
          await this.appendFile(record.buffer)
        } else {
          let recordType = RecordType.kMiddleType
          position += kBlockSize - 7
          const record = new LogRecord(recordType, new Slice(recordOp.buffer.slice(startPosition, position)))
          this._currentBlockSize = 0
          await this.appendFile(record.buffer)
        }
      }
    }
  }

  parseRecord (record:Buffer) {
    const bodyLen = this.buf2Integer(record.slice(3, 5))
    const body = record.slice(7, bodyLen)
    const keyLen = this.buf2Integer(body.slice(0, 2))
    const key = body.slice(2, 2 + keyLen)
    const value = body.slice(4 + keyLen)
    return {
      key,
      value
    }
  }

  length2Buf (len:number) {
    const buf = Buffer.alloc(2)
    buf[0] = len & 0xff
    buf[1] = len >> 8
    return buf
  }

  buf2Integer (buf:Buffer) {
    return buf.readUInt16LE(0)
  }

  /**
   * get record length from record header
   */
  getLengthFromHeader (header:Buffer) {
    const buf = Buffer.alloc(2)
    buf[0] = header[4]
    buf[1] = header[5]
    return this.buf2Integer(buf)
  }
}

export default Log
