import crc32 from 'buffer-crc32'
import Enum from 'enum'
import varint from 'varint'
// eslint-disable-next-line
import SSTableRecord from './SSTableRecord' 

const CompressionTypes = new Enum({
  'none': 0
})

export default class SSTableBlock {
  constructor (buffer = Buffer.from([]), offset, size) {
    this._buffer = buffer
    this._offset = offset || 0
    this._size = size || buffer.length
  }

  get buffer () {
    return this._buffer
  }

  get size () {
    return this._size
  }

  get offset () {
    return this._offset
  }

  get crc32 () {
    return this._buffer.slice(this.offset + this._size - 4, 4)
  }

  /**
   * @type {number}
   */
  get compressionType () {
    return this._buffer.slice(this.offset + this._size - 5, 1)
  }

  * iterator () {
    let offset = this._offset
    while (true) {
      const record = new SSTableRecord(this._buffer, offset)
      yield record.get()
      offset += record.length
      if (offset >= this._size - 5) {
        return
      }
    }
  }

  append (data) {
    const record = new SSTableRecord()
    record.put(data.key, data.value)
    let buf
    if (this._buffer && this._size > 5) {
      buf = Buffer.concat([
        this._buffer.slice(0, this._size - 5),
        record.buffer
      ])
    } else {
      buf = record.buffer
    }

    const compressionType = Buffer.from(varint.encode(CompressionTypes.get('none').value))
    const crc32buffer = crc32(buf)
    this._buffer = Buffer.concat([
      buf,
      compressionType,
      crc32buffer
    ])
    this._offset = 0
    this._size = this._buffer.length
  }
}
