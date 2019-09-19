/* global Generator */

import Slice from './Slice'

export default class SkiplistNode {
  constructor (maxlevel:number, next:SkiplistNode, key:Slice) {
    this.key = key
    this.maxlevel = maxlevel
    this.levels = new Array(maxlevel + 1)
    this.fill(next)
  }

  key:Slice
  maxlevel:number
  levels:Slice[]

  /**
   * 将这个节点的每一级都链接到next
   */
  fill (next:SkiplistNode) {
    for (let i = 0; i <= this.maxlevel; i++) {
      this.levels[i] = next
    }
  }

  forEach (cb: (node:SkiplistNode) => void) {
    for (let i = 0; i <= this.maxlevel; i++) {
      cb(this.levels[i], i)
    }
  }

  * iterator ():Generator<SkiplistNode, void, void> {
    for (let i = 0; i <= this.maxlevel; i++) {
      yield (this.levels[i])
    }
  }

  next ():SkiplistNode {
    return this.levels[0]
  }
}
