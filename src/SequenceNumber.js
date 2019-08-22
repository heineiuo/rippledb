/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @flow
export default class SequenceNumber {
  constructor (initial:number = 0) {
    this._value = initial
  }

  _value: number

  get value () {
    this._value++
    return this._value
  }
}
