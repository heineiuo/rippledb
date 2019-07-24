import SSTableBlock from './SSTableBlock'

export default class TableIndexBlock extends SSTableBlock {
  static fromBuffer (buffer) {

  }

  constructor (data) {
    super(data)
    this.block_type = 'TableIndexBlock'
    this._list = []
  }

  * iterator () {
    yield * this._list
  }
}
