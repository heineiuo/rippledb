/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert'
import Slice from './Slice'
import { Record, kBlockSize, RecordType, kHeaderSize } from './LogFormat'
import { FileHandle } from './Env'

export default class LogReader {
  constructor(file: FileHandle) {
    this._file = file
  }

  _file: FileHandle

  async close(): Promise<void> {
    if (!!this._file) {
      const file = this._file
      delete this._file
      try {
        await file.close()
      } catch (e) {}
    }
  }

  async *iterator(): AsyncIterableIterator<Slice> {
    const buf: Buffer = Buffer.from(new ArrayBuffer(kBlockSize))
    let blockIndex = -1
    let latestOpBuf = Buffer.alloc(0)
    let latestType = null
    let bufHandledPosition = 0
    while (true) {
      // read file fragment to `buf`
      if (blockIndex === -1 || bufHandledPosition >= kBlockSize - kHeaderSize) {
        const position = ++blockIndex * kBlockSize
        const { bytesRead } = await this._file.read(
          buf,
          0,
          kBlockSize,
          position
        )
        if (bytesRead === 0) {
          await this.close()
          return
        }
        bufHandledPosition = 0
        continue
      }

      // buf may be re-fill, to avoid this, copy it
      const record = this.readPhysicalRecord(
        Buffer.from(buf.slice(bufHandledPosition))
      )
      bufHandledPosition += record.length + kHeaderSize
      if (record.type === RecordType.kFullType) {
        const opSlice = new Slice(record.data.buffer)
        yield opSlice
      } else if (record.type === RecordType.kLastType) {
        assert(latestType !== RecordType.kLastType)
        latestOpBuf = Buffer.concat([latestOpBuf, record.data.buffer])
        const opSlice = new Slice(latestOpBuf)
        latestOpBuf = Buffer.alloc(0)
        yield opSlice
      } else if (record.type === RecordType.kFirstType) {
        assert(latestType !== RecordType.kFirstType)
        latestOpBuf = record.data.buffer
      } else if (record.type === RecordType.kMiddleType) {
        latestOpBuf = Buffer.concat([latestOpBuf, record.data.buffer])
      } else if (record.type === RecordType.kZeroType) {
        // skip this block
        latestType = record.type
        bufHandledPosition = kBlockSize
      }
      latestType = record.type
    }
  }

  private readPhysicalRecord(buf: Buffer): Record {
    const head = buf.slice(0, kHeaderSize)
    const recordType = head[6]
    const head4 = head[4] & 0xff
    const head5 = head[5] & 0xff
    const length = head4 | (head5 << 8)

    const data = new Slice(buf.slice(kHeaderSize, kHeaderSize + length))
    return {
      length,
      data,
      type: recordType,
    }
  }
}
