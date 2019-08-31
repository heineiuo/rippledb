/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* global Generator */

import assert from 'assert'
import Slice from './Slice'
import SkiplistNode from './SkiplistNode'

const PROBABILITY = 1 / Math.E

export default class Skiplist {
  constructor (maxsize:number, keyComparator:(a:Slice, b:Slice) => number) {
    this.maxsize = maxsize || 65535
    this.maxlevel = 11 // Math.round(Math.log(this.maxsize, 2))
    this.level = 0

    // 开局的时候，tail是NIL， head指向tail
    // [] -------> []
    // [] -------> []
    // [] -------> []
    // [] -------> []
    // [] -------> []
    // head       tail
    this.tail = new SkiplistNode(this.maxlevel)
    this.tail.fill(this.tail)
    this.keyComparator = keyComparator
    this.head = new SkiplistNode(this.maxlevel, this.tail)
  }

  maxsize:number
  maxlevel:number
  level:number
  tail:SkiplistNode
  head:SkiplistNode

  generateNodeLevel ():number {
    let nodeLevel = 0
    const max = Math.min(this.maxlevel, this.level + 1)
    while (Math.random() < PROBABILITY && nodeLevel < max) {
      nodeLevel++
    }
    return nodeLevel
  }

  // === findGreaterOrEqual
  findPrevNode (key:Slice, shouldUpdatePrevNodes:SkiplistNode[] = []):SkiplistNode {
    let level = this.maxlevel
    let prevNode = this.head
    let current = prevNode.levels[level]
    // let times = 0
    while (level >= 0) {
      // times ++
      assert(prevNode.levels.length > level, 'prevNode level length must bigger then level')

      shouldUpdatePrevNodes[level] = prevNode
      current = prevNode.levels[level]

      // 如果当前节点的next节点是this.tail
      //  如果level已经是0，则循环结束，说明插入节点最大，
      //  否则继续向下查找
      //  如果key比下一个节点的key小，则循环结束
      //   如果next节点的key比插入节点小，则查找next节点是否存在
      //   next节点且比key大
      if (!(current === this.tail) && this.keyComparator(current.key, key) < 0) {
        prevNode = current
        continue
      }
      level--
    }

    // console.log(`${key} find times: ${times}`)

    return prevNode
  }

  * iterator ():Generator<Slice, void, void> {

  }

  get (key:Slice):SkiplistNode {
    let prevNode = this.findPrevNode(key)
    if (!prevNode) return null
    let current = prevNode.next()
    if (!current.key) return null
    if (this.keyComparator(current.key, key) === 0) return current.key
    return null
  }

  del (key:Slice) {
    let update = new Array(this.maxlevel + 1)
    let prevNode = this.findPrevNode(key, update)
    if (!prevNode) return null
    let node = prevNode.next()
    if (this.keyComparator(node.key, key) !== 0) return

    for (let i = 0; i <= node.maxlevel; i++) {
      if (update[i]) {
        update[i].levels[i] = node.levels[i]
      }
    }
  }

  put (key:Slice) {
    let shouldUpdatePrevNodes = new Array(this.maxlevel + 1)
    let prevNode = this.findPrevNode(key, shouldUpdatePrevNodes)
    // 如果是相同的key则不处理
    // 否则创建新节点
    let isDifferent = false
    if (prevNode === this.head) {
      isDifferent = true
    } else if (this.keyComparator(prevNode.key, key) !== 0) {
      isDifferent = true
    }
    if (isDifferent) {
      const nodeLevel = this.generateNodeLevel()
      this.level = Math.max(nodeLevel, this.level)
      const node = new SkiplistNode(nodeLevel, prevNode.next(), key)

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
