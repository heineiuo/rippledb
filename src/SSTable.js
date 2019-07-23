/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @module SSTable
 */

// import path from 'path'
import fs from 'fs'
import Footer from './TableFooter'

class SSTable {
  static async fromFile (filePath) {
    const buf = await fs.readFile(filePath)
    const footer = Footer.fromFile(buf)
    const table = new SSTable({
      footer
    })
    return table
  }

  constructor(options) {
    this.footer = options.footer
  }

  append() {

  }

  async *keyIterator () {

  }

  async *blockIterator () {

  }

  getMetaIndex = () => {

  }

  getIndex = () => {

  }
}

/** 
 * Create a sstable class
 * @constructor
 */
export default SSTable