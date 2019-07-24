import crc32 from 'buffer-crc32'
import Enum from 'enum'
import varint from 'varint'
// eslint-disable-next-line
import SSTableRecord from './SSTableRecord' 

const CompressionTypes = new Enum({
  'none': 0
})

export default class SSTableBlock {
  constructor (buffer) {
    this._buffer = buffer
  }

  get crc32 () {
    return Buffer.slice(this._buffer.length - 4, 4)
  }

  /**
   * @type {number}
   */
  get compressionType () {
    return this._buffer.slice(Buffer.length - 5, 1)
  }

  get buffer () {
    return this._buffer
  }

  * iterator () {
    let offset = 0
    while (true) {
      const record = new SSTableRecord(this._buffer, offset)
      yield record.get()
      offset += record.length
      if (offset >= this._buffer.length - 5) {
        return
      }
    }
    // yield * this._buffer
  }

  append (data) {
    const record = new SSTableRecord()
    record.put(data.key, data.value)
    let buf
    if (this._buffer && this._buffer.length > 5) {
      buf = Buffer.concat([
        this._buffer.slice(0, this._buffer.length - 5),
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
  }
}
