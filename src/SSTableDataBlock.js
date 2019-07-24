import SSTableBlock from './SSTableBlock'

export default class TableDataBlock extends SSTableBlock {
  constructor (data) {
    super(data)
    this.block_type = 'TableDataBlock'
  }
}
