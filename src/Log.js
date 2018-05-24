import path from 'path'
import fs from 'fs'
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
  constructor(workdir) {
    this._file = path.resolve(workdir, './LOG');
  }

  append() {

  }

  length2Buf = (len) => {
    const buf = Buffer.from({ length: 2 });
    buf[0] = len & 0xff;
    buf[1] = len >> 8;
    return buf;
  }

  buf2Integer = (buf) => {
    return Number(buf.readUInt16LE(0).toString(10));
  }

  // get record length from record header
  getLengthFromHeader = (header) => {
    const buf = Buffer.from({ length: 2 });
    buf[0] = header[4];
    buf[1] = header[5];
    return this.buf2Integer(buf);
  }
}

export default Log