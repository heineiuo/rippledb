/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @flow
import { Buffer } from 'buffer'

export default class Comparator {

  findShortestSeparator(string1:string, string2:string):string {
    let index = 0
    let same = ''
    let base = ''
    while (true) {
      const left = string1[index]
      const right = string2[index]
      if (!left || !right) return same
      if (left > right) {
        base = right
        break
      }
      if (left < right) {
        base = left
        break
      }
      same += left
      index++
    }
    const nextChar = String.fromCharCode(base.charCodeAt(0) + 1)
    return `${same}${nextChar}`
  }
}
