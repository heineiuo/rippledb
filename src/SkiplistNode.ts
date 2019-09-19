/* global Generator */

import Slice from './Slice'

export default class SkiplistNode {
  constructor(maxlevel: number, next: SkiplistNode | null, key: Slice) {
    this.key = key
    this.maxlevel = maxlevel
    this.levels = new Array(maxlevel + 1)
    this.fill(next)
  }

  key: Slice
  maxlevel: number
  levels: SkiplistNode[] | null[]

  /**
   * 将这个节点的每一级都链接到next
   */
  fill(next: SkiplistNode | null) {
    for (let i = 0; i <= this.maxlevel; i++) {
      this.levels[i] = next
    }
  }

  forEach(cb: (node: SkiplistNode | null, index: number) => void) {
    for (let i = 0; i <= this.maxlevel; i++) {
      cb(this.levels[i], i)
    }
  }

  *iterator(): Generator<SkiplistNode | null, void, void> {
    for (let i = 0; i <= this.maxlevel; i++) {
      yield this.levels[i]
    }
  }

  next(): SkiplistNode | null {
    return this.levels[0]
  }
}
