import TableBlock from './SSTableBlock'

export default class TableMetaBlock extends TableBlock {
  constructor (data) {
    super(data)
    this.block_type = ''
  }
}
