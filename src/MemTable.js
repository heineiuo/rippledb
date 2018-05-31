/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from 'path'
import fs from 'fs'
import Skiplist from './Skiplist2'

class MemTable {
  constructor() {
    this._list = new Skiplist()
  }
  
  
}

export default MemTable