import { Buffer } from 'buffer'
import TableBlock from './SSTableBlock'
import SStableMetaBlock from './SSTableMetaBlock'

export default class TableMetaIndexBlock extends TableBlock {
  * metaBlockIterator () {
    const iterator = this.iterator()
    const meta = iterator.next()
    while (!meta.done) {
      yield meta.iterator()
    }
  }
}
