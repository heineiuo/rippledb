import BloomFilter from 'bloomfilter'
import SSTableBlock from './SSTableBlock'

export default class SSTableMetaBlock extends SSTableBlock {
  constructor (...props) {
    super(...props)
    this._filter = new BloomFilter(
      props,
      16
    )
  }

  get filter () {

  }
}
