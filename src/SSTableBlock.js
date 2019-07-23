
export default class SSTableBlock {
  constructor (data) {
    /**
     * @type Buffer
     */
    this.block_data = data.block_data
    /**
     * @type string
     */
    this.crc32 = data.crc32
    /**
     * @type Enum
     */
    this.type = data.type
  }
}
