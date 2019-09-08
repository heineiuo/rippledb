/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @flow

import Version from './Version'

export default class VersionSet {
  constructor (current) {
    this._current = current
  }

  _manifestFileNumber: number
  _curren: Version

  get current ():Version {
    return this._current
  }

  recover () {

  }

  del (version:Version) {

  }

  add (version:Version) {

  }
}
