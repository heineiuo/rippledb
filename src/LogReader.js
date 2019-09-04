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
import { kBlockSize, RecordType } from './Format'
import Slice from './Slice'

export default class LogReader {
  constructor (filename: string, LogRecord: any) {
    this._filename = filename
    this._LogRecord = LogRecord
  }

  _file: {
    [x: string]: any
  }
  _filename: string
  _LogRecord: {
    parseOp:() => any,
    from:() => any
  }

  async close () {
    await this._file.close()
  }

  async * iterator (): AsyncGenerator<any, void, void> {
    const LogRecord = this._LogRecord
    const fd = await fs.promises.open(this._filename, 'r')
    let buf: Buffer = Buffer.from(new ArrayBuffer(kBlockSize))
    let blockIndex = -1
    let latestOpBuf = Buffer.alloc(0)
    let latestType = null
    let bufHandledPosition = 0
    while (true) {
      if (blockIndex === -1 || (bufHandledPosition >= kBlockSize - 7)) {
        const position = ++blockIndex * kBlockSize
        const { bytesRead } = await fd.read(buf, 0, kBlockSize, position)
        if (bytesRead === 0) {
          await fd.close()
          return
        }
        bufHandledPosition = 0
        continue
      }

      // buf会被覆盖，所以需要拷贝
      const record = LogRecord.from(Buffer.from(buf.slice(bufHandledPosition)))
      bufHandledPosition += record.length
      if (record.type === RecordType.kFullType) {
        const op = new Slice(record.data.buffer)
        yield LogRecord.parseOp(op)
      } else if (record.type === RecordType.kLastType) {
        assert(latestType !== RecordType.kLastType)
        latestOpBuf = Buffer.concat([latestOpBuf, record.data.buffer])
        const op = new Slice(latestOpBuf)
        latestOpBuf = Buffer.alloc(0)
        yield LogRecord.parseOp(op)
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
}
