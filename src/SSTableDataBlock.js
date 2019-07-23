import TableBlock from './SSTableBlock'

class TableDataBlock extends TableBlock {
  constructor (data) {
    super(data)
    this.block_type = 'TableDataBlock'
  }

  get key () {

  }
  get keyLengh () {
    const data = this.block_data
  }

  get valueLength () {

  }

  get value () {

  }
}

export default TableDataBlock
