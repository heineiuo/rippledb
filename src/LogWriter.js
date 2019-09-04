/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// @flow

import assert from 'assert'
import fs from 'fs'
import { kBlockSize, RecordType } from './Format'
import Slice from './Slice'
import LogRecord from './LogRecord'

export default class LogWriter {
  constructor (filename: string) {
    this._filename = filename
    this._currentBlockSize = 0
  }

  _file: {
    [x: string]: any
  }
  _filename: string
  _currentBlockSize: number

  async appendFile (buf: Buffer) {
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
    if (this._currentBlockSize + 7 + recordOp.length <= kBlockSize) {
      // 不需要分割
      const record = new LogRecord(RecordType.kFullType, recordOp)
      this._currentBlockSize += record.length
      await this.appendFile(record.buffer)
    } else {
      let currentRecordOpPosition = 0
      let hasFirstRecordCreated = false
      while (true) {
        const currentFreeSpace = kBlockSize - this._currentBlockSize
        if (currentFreeSpace <= 7) {
          const padBuf = Buffer.alloc(currentFreeSpace)
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
          recordType = RecordType.kFirstType
          hasFirstRecordCreated = true
          assert(this._currentBlockSize + currentRecordSize === kBlockSize)
          this._currentBlockSize = 0
        } else if (remainOp + 7 <= currentFreeSpace) {
          recordType = RecordType.kLastType
          this._currentBlockSize += currentRecordSize
        } else {
          assert(this._currentBlockSize + currentRecordSize === kBlockSize)
          this._currentBlockSize = 0
          recordType = RecordType.kMiddleType
        }

        const record = new LogRecord(recordType, new Slice(recordOp.buffer.slice(startPosition, currentRecordOpPosition)))
        assert(record.length === currentRecordSize)
        await this.appendFile(record.buffer)
        if (recordType === RecordType.kLastType) {
          break
        }
      }
    }
  }
}
