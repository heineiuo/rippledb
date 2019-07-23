"use strict";

exports.__esModule = true;
exports.default = void 0;

var _path = _interopRequireDefault(require("path"));

var _fs = require("fs");

var _bufferCrc = _interopRequireDefault(require("buffer-crc32"));

var _enum = _interopRequireDefault(require("enum"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
const RecordType = new _enum.default({
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
    this._logPath = _path.default.resolve(dbpath, './LOG');
    this._blocks = [];
    this._currentBlock = Buffer.from({
      length: 0
    });
  }
  /**
   * @param {number} initialOffset 
   */


  async readLogRecord(initialOffset) {
    const fd = await _fs.promises.open(this._logPath, 'a+');
    this._buf = await _fs.promises.readFile(this._logPath); // console.log(this._buf.length)
  }

  async append(key, value) {
    await _fs.promises.appendFile(this._logPath);
  }
  /**
   * @param {buffer} strKey 
   * @param {buffer} strValue 
   */


  createRecord(strKey, strValue) {
    const keyLen = this.length2Buf(strKey.length);
    const valLen = this.length2Buf(strValue.length);
    const body = Buffer.concat([keyLen, strKey, valLen, strValue]);
    const checksum = (0, _bufferCrc.default)(body);
    const bodyLen = this.length2Buf(body.length);
    const typeBuf = Buffer.from([RecordType.get('kFullType').value]);
    const header = Buffer.concat([checksum, bodyLen, typeBuf]);
    return Buffer.concat([header, body]);
  }
  /**
   * @param {buffer} record 
   */


  parseRecord(record) {
    const bodyLen = this.buf2Integer(record.slice(3, 5));
    const body = record.slice(7, bodyLen);
    const keyLen = this.buf2Integer(body.slice(0, 2));
    const key = body.slice(2, 2 + keyLen);
    const value = body.slice(4 + keyLen);
    return {
      key,
      value
    };
  }
  /**
   * @param {number} len 
   */


  length2Buf(len) {
    const buf = Buffer.from({
      length: 2
    });
    buf[0] = len & 0xff;
    buf[1] = len >> 8;
    return buf;
  }
  /**
   * @param {buffer} buf 
   */


  buf2Integer(buf) {
    return buf.readUInt16LE(0);
  }
  /**
   * get record length from record header
   * @param {buffer} header 
   */


  getLengthFromHeader(header) {
    const buf = Buffer.from({
      length: 2
    });
    buf[0] = header[4];
    buf[1] = header[5];
    return this.buf2Integer(buf);
  }

}

var _default = Log;
exports.default = _default;