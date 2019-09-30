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

export default class Skiplist {
  constructor(maxsize: number, keyComparator: (a: Slice, b: Slice) => number) {
    this.maxsize = maxsize || 65535
    this.maxlevel = 11 // Math.round(Math.log(this.maxsize, 2))
    this.level = 0

    // When initial，tail is null head link to tail
    // [] -------> []
    // [] -------> []
    // [] -------> []
    // [] -------> []
    // [] -------> []
    // head       tail
    this.keyComparator = keyComparator
    this.head = new SkiplistNode(this.maxlevel, new Slice())
  }

  keyComparator: (a: Slice, b: Slice) => number
  maxsize: number
  maxlevel: number
  level: number
  head: SkiplistNode

  generateNodeLevel(): number {
    let nodeLevel = 0
    const max = Math.min(this.maxlevel, this.level + 1)
    while (Math.random() < PROBABILITY && nodeLevel < max) {
      nodeLevel++
    }
    return nodeLevel
  }

  // === findGreaterOrEqual
  findPrevNode(
    key: Slice,
    shouldUpdatePrevNodes: SkiplistNode[] = []
  ): SkiplistNode {
    let level = this.maxlevel
    let prevNode = this.head
    let current = prevNode.levels[level]
    // let times = 0
    while (level >= 0) {
      // times ++
      assert(
        prevNode.levels.length > level,
        'prevNode level length must bigger then level'
      )

      shouldUpdatePrevNodes[level] = prevNode
      current = prevNode.levels[level]

      // if current node's next is null
      //  if level === 0，then loop end, the inserted key is biggest
      //  else keep find in smaller level
      //  if inserted key is small then current key，then loop end
      //   if next nodes's key is smaller then inserted key，then check if next node exist
      //   next node's key is bigger
      if (!!current && this.keyComparator(current.key, key) < 0) {
        prevNode = current
        continue
      }
      level--
    }

    // console.log(`${key} find times: ${times}`)

    return prevNode
  }

  *iterator() {
    let current = this.head
    while (true) {
      if (!current) break
      if (!current.levels[0]) break
      yield current.levels[0].key
      current = current.levels[0]
    }
  }

  get(key: Slice): Slice | null {
    let prevNode = this.findPrevNode(key)
    if (!prevNode) return null
    let current = prevNode.next()
    if (!current) return null
    if (this.keyComparator(current.key, key) === 0) return current.key
    return null
  }

  del(key: Slice) {
    let update = new Array(this.maxlevel + 1)
    let prevNode = this.findPrevNode(key, update)
    if (!prevNode) return null
    let node = prevNode.next()
    if (!node) return null
    if (this.keyComparator(node.key, key) !== 0) return

    for (let i = 0; i <= node.maxlevel; i++) {
      if (update[i]) {
        update[i].levels[i] = node.levels[i]
      }
    }
  }

  put(key: Slice) {
    let shouldUpdatePrevNodes = new Array(this.maxlevel + 1)
    let prevNode = this.findPrevNode(key, shouldUpdatePrevNodes)
    // do nothing if key is equal
    // else create new node
    let isDifferent = false
    if (prevNode === this.head) {
      isDifferent = true
    } else if (this.keyComparator(prevNode.key, key) !== 0) {
      isDifferent = true
    }
    if (isDifferent) {
      const nodeLevel = this.generateNodeLevel()
      this.level = Math.max(nodeLevel, this.level)
      const node = new SkiplistNode(nodeLevel, key, prevNode.next())

      for (let i = 0; i <= nodeLevel; i++) {
        if (shouldUpdatePrevNodes[i]) {
          node.levels[i] = shouldUpdatePrevNodes[i].levels[i]
          shouldUpdatePrevNodes[i].levels[i] = node
        }
        // prevNode.levels[i] = node
      }
    }
  }
}
