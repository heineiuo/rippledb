/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Slice from './Slice'

export default class SkiplistNode {
  constructor(maxlevel: number, key: Slice, next?: SkiplistNode) {
    this.key = key
    this.maxlevel = maxlevel
    this.levels = new Array(maxlevel + 1)
    if (!!next) this.fill(next)
  }

  key: Slice
  maxlevel: number
  levels: SkiplistNode[]

  /**
   * link every level in this node to next
   */
  fill(next: SkiplistNode) {
    for (let i = 0; i <= this.maxlevel; i++) {
      this.levels[i] = next
    }
  }

  forEach(cb: (node: SkiplistNode, index: number) => void) {
    for (let i = 0; i <= this.maxlevel; i++) {
      cb(this.levels[i], i)
    }
  }

  *iterator(): IterableIterator<SkiplistNode> {
    for (let i = 0; i <= this.maxlevel; i++) {
      yield this.levels[i]
    }
  }

  next(level: number): SkiplistNode {
    return this.levels[level]
  }
}
