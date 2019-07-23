/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from 'fs'
import Footer from './TableFooter'

/**
 * Create a sstable class
 * @constructor
 */
export default class SSTable {
  static async fromFile (filePath) {
    const buf = await fs.readFile(filePath)
    const footer = Footer.fromFile(buf)
    const table = new SSTable({
      footer
    })
    return table
  }

  constructor (options) {
    this.footer = options.footer
  }

  immutable = false

  append () {

  }

  async * keyIterator () {

  }

  async * blockIterator () {

  }

  getMetaIndex = () => {

  }

  getIndex = () => {

  }
}
