"use strict";

exports.__esModule = true;
exports.default = void 0;

var _varint = _interopRequireDefault(require("varint"));

var _LevelUtils = require("./LevelUtils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class Footer {
  static fromFile(fileBuf) {
    if (fileBuf.length < 48) throw new RangeError('Illegal file');
    const footer = new Footer();
    footer.decode((0, _LevelUtils.subbuf)(fileBuf, fileBuf.length - 48));
    return footer;
  }

  constructor() {
    // meta block索引信息
    this.metaIndexOffset = 0;
    this.metaIndexSize = 0; // data block 索引信息

    this.indexOffset = 0;
    this.indexSize = 0;
  }

  encode() {
    const handlers = Buffer.concat([Buffer.from(_varint.default.encode(this.metaIndexOffset)), Buffer.from(_varint.default.encode(this.metaIndexSize)), Buffer.from(_varint.default.encode(this.indexOffset)), Buffer.from(_varint.default.encode(this.indexSize))]);
    const paddingBuf = Buffer.from({
      length: 40 - handlers.length
    });
    return Buffer.concat([handlers, paddingBuf, Buffer.from({
      length: 8
    })]);
  } // sstable文件中footer中可以解码出在文件的结尾处距离footer
  // 最近的index block的BlockHandle，
  // 以及metaindex block的BlockHandle，从而确定这两个组成部分在文件中的位置。
  // footer 48Bytes = metaindexhandle(0~20Bytes) + indexHandle(0-20byptes) + padding(0-40bytes) + magicNumber(8bytes)


  decode(buf) {
    this.metaIndexOffset = _varint.default.decode(buf, 0);
    this.metaIndexSize = _varint.default.decode(buf, _varint.default.decode.bytes);
    this.indexOffset = _varint.default.decode(buf, _varint.default.decode.bytes);
    this.indexSize = _varint.default.decode(buf, _varint.default.decode.bytes);
  }

}

var _default = Footer;
exports.default = _default;