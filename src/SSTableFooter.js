import varint from 'varint'
import { subbuf } from './LevelUtils'

/**
 * 置于 table 末尾，固定 48 byte，
 * 包含指向各个分区（ data index block 以及 meta index block ）
 * 的偏移量和大小，读取 table 时从末尾开始读取。
 */
export default class TableFooter {
  static fromBuffer (fileBuf) {
    if (fileBuf.length < 48) throw new RangeError('Illegal file')
    const footer = new TableFooter()
    footer.decode(subbuf(fileBuf, fileBuf.length - 48))
    return footer
  }

  constructor () {
    // meta block索引信息
    this.metaIndexOffset = 0
    this.metaIndexSize = 0
    // data block 索引信息
    this.indexOffset = 0
    this.indexSize = 0
  }

  encode () {
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

  // sstable文件中footer中可以解码出在文件的结尾处距离footer
  // 最近的index block的BlockHandle，
  // 以及metaindex block的BlockHandle，从而确定这两个组成部分在文件中的位置。
  // footer 48Bytes = metaindexhandle(0~20Bytes) + indexHandle(0-20byptes) + padding(0-40bytes) + magicNumber(8bytes)
  decode (buf) {
    this.metaIndexOffset = varint.decode(buf, 0)
    this.metaIndexSize = varint.decode(buf, varint.decode.bytes)
    this.indexOffset = varint.decode(buf, varint.decode.bytes)
    this.indexSize = varint.decode(buf, varint.decode.bytes)
  }
}
