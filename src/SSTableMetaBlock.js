import BloomFilter from 'bloomfilter'
import SSTableRecord from './SSTableRecord'

export default class SSTableMetaBlock {
  static fromBuffer (buf) {

  }

  constructor (data) {
    this._filter = new BloomFilter(
      data,
      16
    )
  }

  add () {

  }

  contains () {

  }
}
