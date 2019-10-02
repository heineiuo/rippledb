/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from 'fs'

export default class Env {
  /**
   * get current time
   */
  static now(): number {
    return Number(process.hrtime.bigint()) / Math.pow(10, 9)
  }
}

export interface FileHandle extends fs.promises.FileHandle {}
