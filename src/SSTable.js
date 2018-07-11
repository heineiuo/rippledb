/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @module SSTable
 */

import path from 'path'
import fs from 'fs'
import Footer from './TableFooter'

class SSTable {
  static fromFile (file_path) {
    const buf = fs.readFileSync(file_path)
    const footer = Footer.fromFile(buf)
    const table = new SSTable({
      footer
    })
    return table
  }

  constructor(file_path) {
  }

  append() {

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