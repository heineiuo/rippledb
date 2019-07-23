
export default class SSTableBlock {
  constructor (data) {
    /**
     * @type Buffer
     */
    this._block_data = data.block_data
    /**
     * @type string
     */
    this._crc32 = data.crc32
    /**
     * @type Enum
     */
    this._compression_type = data.compression_type
  }

  get crc () {
    return this._crc32
  }

  get blockData () {
    return this._block_data
  }

  get compressionType () {
    return this._compression_type
  }

  /**
   * 1. 遍历blockData内的record, 调用record.toBuffer()
   * 2. 拼接compressionType
   * 3. 拼接crc
   */
  toBuffer () {
  }
}
