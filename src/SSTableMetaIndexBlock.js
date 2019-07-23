import TableBlock from './SSTableBlock'

export default class TableMetaIndexBlock extends TableBlock {
  constructor (data) {
    super(data)
    this.block_type = ''
  }
}
