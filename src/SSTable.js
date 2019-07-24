/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Footer from './SSTableFooter'
import IndexBlock from './SSTableIndexBlock'

/**
 * Create a sstable class
 * @constructor
 */
export default class SSTable {
  static async fromBuffer (buf, options = {}) {
    const footer = Footer.fromFile(buf)
    const indexBlockBuf = buf.slice(footer.indexBlock, footer.indexBlock + footer.indexBlockLength)
    const indexBlock = IndexBlock.fromBuffer(indexBlockBuf)
    const table = new SSTable()
    table.footer = footer
    table.indexBlock = indexBlock
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

  getMetaIndex = () => {

  }

  getIndex = () => {

  }
}
