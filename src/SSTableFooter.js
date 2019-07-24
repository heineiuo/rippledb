import varint from 'varint'
import { subbuf } from './LevelUtils'

/**
 * 置于 table 末尾，固定 48 byte，
 * 包含指向各个分区（ data index block 以及 meta index block ）
 * 的偏移量和大小，读取 table 时从末尾开始读取。
 */
export default class TableFooter {
  /**
   *
   * @param {Buffer} fileBuf
   * @return {TableFooter}
   */
  static fromBuffer (fileBuf) {
    if (fileBuf.length < 48) throw new RangeError('Illegal file')

    // sstable文件中footer中可以解码出在文件的结尾处距离footer
    // 最近的index block的BlockHandle，
    // 以及metaindex block的BlockHandle，从而确定这两个组成部分在文件中的位置。
    // footer 48Bytes = metaindexhandle(0~20Bytes) + indexHandle(0-20byptes) + padding(0-40bytes) + magicNumber(8bytes)
    const buf = subbuf(fileBuf, fileBuf.length - 48)
    const metaIndexOffset = varint.decode(buf, 0)
    const metaIndexSize = varint.decode(buf, varint.decode.bytes)
    const indexOffset = varint.decode(buf, varint.decode.bytes)
    const indexSize = varint.decode(buf, varint.decode.bytes)

    const footer = new TableFooter({
      metaIndexOffset,
      metaIndexSize,
      indexOffset,
      indexSize
    })
    return footer
  }

  constructor ({
    metaIndexOffset,
    metaIndexSize,
    indexOffset,
    indexSize
  }) {
    // meta block索引信息
    this._metaIndexOffset = metaIndexOffset
    this._metaIndexSize = metaIndexSize
    // data block 索引信息
    this._indexOffset = indexOffset
    this._indexSize = indexSize
  }

  /**
   * @type {Number}
   */
  get metaIndexOffset () { return this._metaIndexOffset }
  /**
   * @type {Number}
   */
  get metaIndexSize () { return this._metaIndexSize }
  /**
   * @type {Number}
   */
  get indexOffset () { return this._indexOffset }
  /**
   * @type {Number}
   */
  get indexSize () { return this._indexSize }

  set metaIndexOffset (value) { this._metaIndexOffset = value }
  set metaIndexSize (value) { this._metaIndexSize = value }
  set indexOffset (value) { this._indexOffset = value }
  set indexSize (value) { this._indexSize = value }

  toBuffer () {
    const handlers = Buffer.concat([
      Buffer.from(varint.encode(this.metaIndexOffset)),
      Buffer.from(varint.encode(this.metaIndexSize)),
      Buffer.from(varint.encode(this.indexOffset)),
      Buffer.from(varint.encode(this.indexSize))
    ])
    const paddingBuf = Buffer.from({ length: 40 - handlers.length })
    return Buffer.concat([
      handlers,
      paddingBuf,
      Buffer.from({ length: 8 })
    ])
  }
}
