/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Buffer } from 'buffer'
import { EncodingOptions } from './Options'
import Slice from './Slice'
import Footer from './SSTableFooter'
import IndexBlock from './SSTableIndexBlock'
import DataBlock from './SSTableDataBlock'
import MetaIndexBlock from './SSTableMetaIndexBlock'

/**
 * Create a sstable class
 * @constructor
 */
export default class SSTable {
  _footer: Footer
  _immutable: boolean
  _cacheData: Buffer
  _indexBlock: IndexBlock
  _dataBlock!: DataBlock
  _metaIndexBlock: MetaIndexBlock

  constructor(
    buf: Buffer,
    options: { immutable: boolean } = { immutable: false }
  ) {
    this._footer = new Footer(buf)
    const footerData = this._footer.get()
    const metaIndexBlockBuf = buf.slice(
      footerData.metaIndexOffset,
      footerData.metaIndexOffset + footerData.metaIndexSize
    )
    this._indexBlock = new IndexBlock(
      buf,
      footerData.indexOffset,
      footerData.indexSize
    )
    this._metaIndexBlock = new MetaIndexBlock(metaIndexBlockBuf)
    this._immutable = options.immutable
    this._cacheData = Buffer.from([])
  }

  get(key: Slice, options?: EncodingOptions): Buffer | null | string {
    let target
    for (let value of this.dataBlockIterator()) {
      if (key.compare(new Slice(value.key)) === 0) {
        target = value.value
      }
    }
    if (!target) return null
    if (!options) return target.buffer
    if (options.valueEncoding === 'string') return target.toString()
    return target.buffer
  }

  // *iterator() {
  //   return
  // }

  *dataBlockIterator() {
    yield* this._indexBlock.dataBlockIterator()
  }

  *indexBlockIterator() {
    yield* this._indexBlock.iterator()
  }
}
