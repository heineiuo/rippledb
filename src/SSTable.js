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
  static async fromBuffer (buf, options = {}) {
    const footer = Footer.fromBuffer(buf)
    const indexBlockBuf = buf.slice(footer.indexOffset, footer.indexOffset + footer.indexSize)
    const metaIndexBlockBuf = buf.slice(footer.metaIndexOffset, footer.metaIndexOffset + footer.metaIndexSize)
    const indexBlock = IndexBlock.fromBuffer(indexBlockBuf)
    const metaIndexBlock = MetaIndexBlock.fromBuffer(metaIndexBlockBuf)
    const table = new SSTable()
    table.footer = footer
    table.indexBlock = indexBlock
    table.metaIndexBlock = metaIndexBlock
    if (options.immutable) {
      table.immutable = true
    }
    return table
  }

  constructor () {
    this._immutable = false
  }

  get immutable () {
    return this._immutable
  }

  set immutable (next) {
    if (next) this._immutable = true
  }

  append () {

  }

  * keyIterator () {

  }

  * blockIterator () {

  }

  * indexIterator () {
    yield * this._indexBlock.iterator()
  }
}
