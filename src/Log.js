/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// @flow

import path from 'path'
import fs from 'fs'
import crc32 from 'buffer-crc32'
import Enum from 'enum'
import Slice from './Slice'

const RecordType = new Enum({
  // Zero is reserved for preallocated files
  kZeroType: 0,

  kFullType: 1,

  // For fragments
  kFirstType: 2,
  kMiddleType: 3,
  kLastType: 4
})

const kBlockSize = 32768 // 32KB

class Log {
  constructor (dbpath:string) {
    this._logPath = path.resolve(dbpath, './LOG')
    this._blocks = []
    this._currentBlock = Buffer.alloc(0)
  }

  _file: {
    [x:string]:any
  }
  _logPath:string
  _blocks: Buffer[]
  _currentBlock: Buffer
  _buf: Buffer

  async readLogRecord (initialOffset:number) {
    const fd = await fs.promises.open(this._logPath, 'a+')
    this._buf = await fs.promises.readFile(this._logPath)
    console.log('Log.readLogRecord buf length', this._buf.length)
  }

  async append (key:Slice, value:Slice) {
    await this._file.appendFile(this._logPath)
  }

  createRecord (strKey:Slice, strValue:Slice) {
    const keyLen = this.length2Buf(strKey.length)
    const valLen = this.length2Buf(strValue.length)
    const body = Buffer.concat([
      keyLen,
      new Slice(strKey).buffer,
      valLen,
      new Slice(strValue).buffer
    ])
    const checksum = crc32(body)
    const bodyLen = this.length2Buf(body.length)
    const typeBuf = Buffer.from([RecordType.get('kFullType').value])
    const header = Buffer.concat([checksum, bodyLen, typeBuf])
    return Buffer.concat([header, body])
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
