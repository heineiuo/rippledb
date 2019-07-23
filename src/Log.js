/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from 'path'
import { promises as fs } from 'fs'
import crc32 from 'buffer-crc32'
import Enum from 'enum'

const RecordType = new Enum({
  // Zero is reserved for preallocated files
  kZeroType: 0,

  kFullType: 1,

  // For fragments
  kFirstType: 2,
  kMiddleType: 3,
  kLastType: 4
});

const kBlockSize = 32768; // 32KB

class Log {
  constructor(dbpath) {
    this._logPath = path.resolve(dbpath, './LOG')
    this._blocks = []
    this._currentBlock = Buffer.from({ length: 0 })
  }

  /**
   * @param {number} initialOffset 
   */
  async readLogRecord(initialOffset) {
    const fd = await fs.open(this._logPath, 'a+');
    this._buf = await fs.readFile(this._logPath)
    // console.log(this._buf.length)

    
  }

  async append(key, value) {
    await fs.appendFile(this._logPath)
  }

  /**
   * @param {buffer} strKey 
   * @param {buffer} strValue 
   */
  createRecord(strKey, strValue) {
    const keyLen = this.length2Buf(strKey.length)
    const valLen = this.length2Buf(strValue.length)
    const body = Buffer.concat([keyLen, strKey, valLen, strValue])
    const checksum = crc32(body)
    const bodyLen = this.length2Buf(body.length)
    const typeBuf = Buffer.from([RecordType.get('kFullType').value])
    const header = Buffer.concat([checksum, bodyLen, typeBuf])
    return Buffer.concat([header, body])
  }

  /**
   * @param {buffer} record 
   */
  parseRecord(record) {
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

  /**
   * @param {number} len 
   */
  length2Buf(len) {
    const buf = Buffer.from({ length: 2 });
    buf[0] = len & 0xff;
    buf[1] = len >> 8;
    return buf;
  }

  /**
   * @param {buffer} buf 
   */
  buf2Integer(buf) {
    return buf.readUInt16LE(0)
  }

  /**
   * get record length from record header
   * @param {buffer} header 
   */
  getLengthFromHeader(header) {
    const buf = Buffer.from({ length: 2 });
    buf[0] = header[4];
    buf[1] = header[5];
    return this.buf2Integer(buf);
  }
}

export default Log