/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// @flow
/* global Generator */

import { Buffer } from 'buffer'
import Footer from './SSTableFooter'
import IndexBlock from './SSTableIndexBlock'
import DataBlock from './SSTableDataBlock'
import MetaIndexBlock from './SSTableMetaIndexBlock'

/**
 * Create a sstable class
 * @constructor
 */
export default class SSTable {
  constructor (buf: Buffer, options?: { immutable: boolean } = {}) {
    this._footer = new Footer(buf)
    const footerData = this._footer.get()
    const metaIndexBlockBuf = buf.slice(footerData.metaIndexOffset, footerData.metaIndexOffset + footerData.metaIndexSize)
    this._indexBlock = new IndexBlock(buf, footerData.indexOffset, footerData.indexSize)
    this._metaIndexBlock = new MetaIndexBlock(metaIndexBlockBuf)
    this._immutable = options.immutable || false
    this._cacheData = Buffer.from([])
  }

  _footer: Footer
  _immutable: boolean
  _cacheData: Buffer
  _indexBlock: IndexBlock
  _dataBlock: DataBlock
  _metaIndexBlock: MetaIndexBlock

  get immutable (): boolean {
    return this._immutable
  }

  set immutable (next: boolean) {
    if (next) this._immutable = true
  }

  get (key:string):string | null {
    const indexBlockIterator = this.dataBlockIterator()
    let result = indexBlockIterator.next()
    while (!result.done) {
      if (key === result.value.key) {
        return result.value.value
      }
      result = indexBlockIterator.next()
    }
    return null
  }

  * iterator ():Generator<any, void, void> {

  }

  * dataBlockIterator ():Generator<any, void, void> {
    yield * this._indexBlock.dataBlockIterator()
  }

  * indexBlockIterator ():Generator<any, void, void> {
    yield * this._indexBlock.iterator()
  }
}
