import SSTableBlock from './SSTableBlock'

export default class TableIndexBlock extends SSTableBlock {
  constructor (data) {
    super(data)
    this.block_type = 'TableIndexBlock'
  }

  get key () {

  }
}
