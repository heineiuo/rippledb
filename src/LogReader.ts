/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert'
import fs from 'fs'
import { Buffer } from 'buffer'
import { kBlockSize, RecordType } from './Format'
import Slice from './Slice'
import { Record } from './LogFormat'

export default class LogReader {
  constructor(filename: string) {
    this._filename = filename
  }

  _file!: fs.promises.FileHandle | null
  _filename: string

  async close() {
    if (!!this._file) {
      await this._file.close()
      this._file = null
    }
  }

  async *iterator(): AsyncIterableIterator<Slice> {
    if (!this._file) {
      this._file = await fs.promises.open(this._filename, 'r')
    }
    let buf: Buffer = Buffer.from(new ArrayBuffer(kBlockSize))
    let blockIndex = -1
    let latestOpBuf = Buffer.alloc(0)
    let latestType = null
    let bufHandledPosition = 0
    while (true) {
      if (blockIndex === -1 || bufHandledPosition >= kBlockSize - 7) {
        const position = ++blockIndex * kBlockSize
        const { bytesRead } = await this._file.read(
          buf,
          0,
          kBlockSize,
          position
        )
        if (bytesRead === 0) {
          await this._file.close()
          return
        }
        bufHandledPosition = 0
        continue
      }

      // buf may be re-fill, to avoid this, copy it
      const record = this.decode(Buffer.from(buf.slice(bufHandledPosition)))
      bufHandledPosition += record.data.length
      if (record.type === RecordType.kFullType) {
        const op = new Slice(record.data.buffer)
        yield op
      } else if (record.type === RecordType.kLastType) {
        assert(latestType !== RecordType.kLastType)
        latestOpBuf = Buffer.concat([latestOpBuf, record.data.buffer])
        const op = new Slice(latestOpBuf)
        latestOpBuf = Buffer.alloc(0)
        yield op
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

  decode(buf: Buffer): Record {
    const length = buf.readUInt16BE(4)
    const type = buf.readUInt8(6)
    const data = new Slice(buf.slice(7, 7 + length))
    assert(length === data.length)
    return {
      data,
      type,
    }
  }
}
