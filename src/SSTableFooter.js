import varint from 'varint'

/**
 * 置于 table 末尾，固定 48 byte，
 * 包含指向各个分区（ data index block 以及 meta index block ）
 * 的偏移量和大小，读取 table 时从末尾开始读取。
 */
export default class TableFooter {
  constructure (buffer) {
    this._buffer = buffer
  }

  get buffer () {
    return this._buffer.slice(this._buffer.length - 48, 48)
  }

  set metaIndexOffset (value) {
    const data = {
      ...this.get(),
      metaIndexOffset: value
    }
    this.put(data)
  }

  set metaIndexSize (value) {
    const data = {
      ...this.get(),
      metaIndexSize: value
    }
    this.put(data)
  }

  set indexOffset (value) {
    const data = {
      ...this.get(),
      indexOffset: value
    }
    this.put(data)
  }

  set indexSize (value) {
    const data = {
      ...this.get(),
      indexSize: value
    }
    this.put(data)
  }

  get () {
    if (!this.buffer) {
      return {
        metaIndexOffset: 0,
        metaIndexSize: 0,
        indexOffset: 0,
        indexSize: 0
      }
    }
    const buf = this.buffer
    const metaIndexOffset = varint.decode(buf, 0)
    const metaIndexSize = varint.decode(buf, varint.decode.bytes)
    const indexOffset = varint.decode(buf, varint.decode.bytes)
    const indexSize = varint.decode(buf, varint.decode.bytes)
    return {
      /**
       * @type {number}
       */
      metaIndexOffset,
      /**
       * @type {number}
       */
      metaIndexSize,
      /**
       * @type {number}
       */
      indexOffset,
      /**
       * @type {number}
       */
      indexSize
    }
  }

  put (data) {
    const handlers = Buffer.concat([
      Buffer.from(varint.encode(data.metaIndexOffset)),
      Buffer.from(varint.encode(data.metaIndexSize)),
      Buffer.from(varint.encode(data.indexOffset)),
      Buffer.from(varint.encode(data.indexSize))
    ])
    const paddingBuf = Buffer.from({ length: 40 - handlers.length })
    this._buffer = Buffer.concat([
      handlers,
      paddingBuf,
      Buffer.from({ length: 8 })
    ])
  }
}
