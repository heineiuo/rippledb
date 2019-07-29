/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Skiplist from './Skiplist'

class MemTable {
  constructor () {
    this._list = new Skiplist()
  }

  immutable = false

  encodeBuf () {

  }

  decodeBuf () {

  }

  get = function * () {

  }

  put (sn, valueType, key, value) {

  }

  createInterator = function * () {

  }
}

export default MemTable
