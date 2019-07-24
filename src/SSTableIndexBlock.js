import SSTableBlock from './SSTableBlock'
import SSTableRecoed from './SSTableRecoed'

export default class TableIndexBlock extends SSTableBlock {
  static fromBuffer (buf) {
    const indexBlock = new TableIndexBlock()
    return indexBlock
  }

  constructor (data) {
    super(data)
    this.block_type = 'TableIndexBlock'
  }
}
