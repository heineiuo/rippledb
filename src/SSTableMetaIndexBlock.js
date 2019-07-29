/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import TableBlock from './SSTableBlock'
import SStableMetaBlock from './SSTableMetaBlock'

export default class TableMetaIndexBlock extends TableBlock {
  * metaBlockIterator () {
    const iterator = this.iterator()
    const record = iterator.next()
    while (!record.done) {
      const meta = new SStableMetaBlock(record.value)
      yield meta.iterator()
    }
  }
}
