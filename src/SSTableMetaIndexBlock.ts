/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import varint from 'varint'
import TableBlock from './SSTableBlock'
import SStableMetaBlock from './SSTableMetaBlock'

export default class TableMetaIndexBlock extends TableBlock {
  get filterKey(): string {
    return `filter.leveldb.BuiltinBloomFilter2`
  }

  /**
   * 实际上MetaBlock只创建一个
   */
  *metaBlockIterator() {
    for (let record of this.iterator()) {
      const { value } = record
      const offset = varint.decode(value.buffer)
      const size = varint.decode(value.buffer, varint.decode.bytes)
      const metaBlock = new SStableMetaBlock(this.buffer, offset, size)
      yield* metaBlock.iterator()
    }
  }
}
