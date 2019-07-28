/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Footer from './SSTableFooter'
import IndexBlock from './SSTableIndexBlock'
import MetaIndexBlock from './SSTableMetaIndexBlock'

/**
 * Create a sstable class
 * @constructor
 */
export default class SSTable {
  /**
   *
   * @param {Buffer} buf
   * @param {object} options
   * @returns {SSTable}
   */
  constructor (buf, options = {}) {
    const footer = new Footer(buf)
    const footerData = footer.get()
    const indexBlockBuf = buf.slice(footerData.indexOffset, footerData.indexOffset + footerData.indexSize)
    const metaIndexBlockBuf = buf.slice(footerData.metaIndexOffset, footerData.metaIndexOffset + footerData.metaIndexSize)
    const indexBlock = IndexBlock.fromBuffer(indexBlockBuf)
    const metaIndexBlock = MetaIndexBlock.fromBuffer(metaIndexBlockBuf)
    this.footer = footer
    this.indexBlock = indexBlock
    this.metaIndexBlock = metaIndexBlock
    this._immutable = options.immutable || false
  }

  get immutable () {
    return this._immutable
  }

  set immutable (next) {
    if (next) this._immutable = true
  }

  append (data) {

  }

  * dataBlockIterator () {
    yield * this.dataBlock.iterator()
  }

  * indexBlockIterator () {
    yield * this.indexBlock.iterator()
  }
}
