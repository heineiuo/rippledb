/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import varint from 'varint'
// import { Buffer } from 'buffer'
import TableBlock from './SSTableBlock'
import SStableMetaBlock from './SSTableMetaBlock'

export default class TableMetaIndexBlock extends TableBlock {
  * metaBlockIterator () {
    const iterator = this.iterator('buffer')
    let record = iterator.next()
    while (!record.done) {
      const { value } = record.value
      const offset = varint.decode(value)
      const size = varint.decode(value, varint.decode.bytes)
      const metaBlock = new SStableMetaBlock(this.buffer, offset, size)
      yield metaBlock.iterator()
      record = iterator.next()
    }
  }
}
