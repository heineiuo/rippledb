/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

 class SequenceNumber {
  constructor() {
    this._value = 0
  }

  increase(){
    this._value ++
  }

  get value() {
    this._value++
    return this._value
  }
}

export default new SequenceNumber()