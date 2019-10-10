/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert'
import Slice from './Slice'
import SkiplistNode from './SkiplistNode'

const PROBABILITY = 1 / Math.E

const kMaxHeight = 12 // Math.round(Math.log(this.maxsize, 2))
const kBranching = 4

export default class Skiplist {
  constructor(maxsize: number, keyComparator: (a: Slice, b: Slice) => number) {
    this.maxsize = maxsize || 65535
    this.level = 0

    // When initial，tail is null head link to tail
    // [] -------> []
    // [] -------> []
    // [] -------> []
    // [] -------> []
    // [] -------> []
    // head       tail
    this.keyComparator = keyComparator
    this.head = new SkiplistNode(kMaxHeight, new Slice())
  }

  keyComparator: (a: Slice, b: Slice) => number
  maxsize: number
  level: number
  head: SkiplistNode

  private isKeyAfterNode(key: Slice, node: SkiplistNode): boolean {
    return !!node && this.keyComparator(node.key, key) < 0
  }

  private generateNodeLevel(): number {
    let nodeLevel = 1
    const max = Math.min(kMaxHeight, this.level + 1)
    while (Math.random() < PROBABILITY && nodeLevel < max) {
      nodeLevel++
    }
    assert(nodeLevel > 0)
    assert(nodeLevel <= kMaxHeight)
    return nodeLevel
  }

  private findGreaterOrEqual(
    key: Slice,
    shouldUpdatePrevNodes?: SkiplistNode[]
  ): SkiplistNode {
    let level = kMaxHeight
    let current = this.head
    while (true) {
      const next = current.next(level)
      // if current node's next is null
      //  if level === 0，then loop end, the inserted key is biggest
      //  else keep find in smaller level
      //  if inserted key is small then current key，then loop end
      //   if next nodes's key is smaller then inserted key，then check if next node exist
      //   next node's key is bigger
      if (this.isKeyAfterNode(key, next)) {
        current = next
      } else {
        if (shouldUpdatePrevNodes) shouldUpdatePrevNodes[level] = current
        if (level === 0) {
          return next
        } else {
          level--
        }
      }
    }
  }

  *iterator(): IterableIterator<Slice> {
    let current = this.head
    while (true) {
      if (!current) break
      if (!current.next(0)) break
      yield current.next(0).key
      current = current.next(0)
    }
  }

  private isEqual(a: Slice, b: Slice): boolean {
    return a.isEqual(b)
  }

  // TODO maybe there is something error
  //   Advance to the first entry with a key >= target
  public seek(key: Slice): SkiplistNode {
    let prevNode = this.findGreaterOrEqual(key)
    return prevNode
  }

  public put(key: Slice) {
    let shouldUpdatePrevNodes = new Array(kMaxHeight)
    let prevNode = this.findGreaterOrEqual(key, shouldUpdatePrevNodes)
    assert(!prevNode || !this.isEqual(key, prevNode.key))

    const nodeLevel = this.generateNodeLevel()
    if (nodeLevel > this.level) {
      for (let i = this.level; i < nodeLevel; i++) {
        shouldUpdatePrevNodes[i] = this.head
      }
      this.level = nodeLevel
    }

    const node = new SkiplistNode(nodeLevel, key)

    for (let i = 0; i < nodeLevel; i++) {
      if (shouldUpdatePrevNodes[i]) {
        node.levels[i] = shouldUpdatePrevNodes[i].levels[i]
        shouldUpdatePrevNodes[i].levels[i] = node
      }
    }
  }
}
