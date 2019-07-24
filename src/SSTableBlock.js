import crc32 from 'buffer-crc32'
import Enum from 'enum'
import varint from 'varint'
// eslint-disable-next-line
import SSTableRecord from './SSTableRecord' 

const CompressionTypes = new Enum({
  'none': 0
})

export default class SSTableBlock {
  static fromBuffer (buf) {
    const crc = String(Buffer.slice(Buffer.length - 4, 4))
    const compressionType = String(Buffer.slice(Buffer.length - 5, 1))
    const data = []

    return new SSTableBlock({
      block_data: data,
      compression_type: CompressionTypes.get(varint.decode(compressionType)),
      crc32: crc
    })
  }

  constructor (data) {
    /**
     * @type {SSTableRecord[]}
     */
    this._block_data = data.block_data
    /**
     * @type string
     */
    this._crc32 = data.crc32
    this._compression_type = data.compression_type
  }

  get crc32 () {
    return this._crc32
  }

  /**
   * @type {SSTableRecord[]}
   */
  get blockData () {
    return this._block_data
  }

  /**
   * @type {number}
   */
  get compressionType () {
    return this._compression_type
  }

  append (data) {
    const record = new SSTableRecord()
    record.put(data.key, data.value)
    this.blockBuffer = Buffer.concat([
      this.blockBuffer,
      record.buffer
    ])
  }

  * iterator () {
    yield * this.blockData
  }

  get buffer () {
    return Buffer.concat([
      this.blockBuffer,
      varint.encode(this.compressionType.value),
      crc32(this.blockBuffer)
    ])
  }
}
