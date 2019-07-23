/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert'
import bufferEqual from 'buffer-equal'

const P = 1 / Math.E

/**
 *
 * @param {string|Buffer} a
 * @param {string|Buffer} b
 * @returns {boolean} isEqual
 */
function isEqual (a, b) {
  if (!(Buffer.isBuffer(a) && Buffer.isBuffer(b))) return a === b
  return bufferEqual(a, b)
}

class SkiplistNode {
  /**
   *
   * @param {number} maxlevel
   * @param {SkiplistNode} next
   * @param {string|Buffer} key
   * @param {string|Buffer} value
   */
  constructor (maxlevel, next, key, value) {
    this.key = key
    this.value = value
    this.maxlevel = maxlevel
    this.levels = new Array(maxlevel + 1)
    this.fill(next)
  }

  /**
   *
   * @param {SkiplistNode} next
   */
  fill (next) {
    for (let i = 0; i <= this.maxlevel; i++) {
      this.levels[i] = next
    }
  }

  forEach (cb) {
    for (let i = 0; i <= this.maxlevel; i++) {
      cb(this.levels[i], i)
    }
  }

  next () {
    return this.levels[0]
  }
}

class Skiplist {
  /**
   *
   * @param {number} maxsize
   */
  constructor (maxsize) {
    this.maxsize = maxsize || 65535
    this.maxlevel = Math.round(Math.log(this.maxsize, 2))

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
    this.head = new SkiplistNode(this.maxlevel, this.tail)
  }

  /**
   * @returns {number} randomLevel
   */
  randomLevel () {
    let randomLevel = 0
    const max = Math.min(this.maxlevel, this.level + 1)
    while (Math.random() < P && randomLevel < max) {
      randomLevel++
    }
    return randomLevel
  }

  /**
   *
   * @param {string|Buffer} key
   * @param {SkiplistNode[]} update
   */
  findLess (key, update = []) {
    let level = this.maxlevel
    let prev = this.head
    let current = prev.levels[level]
    // let times = 0
    while (level >= 0) {
      // times ++
      assert(prev.levels.length > level, 'prev level length must bigger then level')

      update[level] = prev
      current = prev.levels[level]

      // 如果当前节点的next节点是this.tail
      //  如果level已经是0，则循环结束，说明插入节点最大，
      //  否则继续向下查找
      //  如果key比下一个节点的key小，则循环结束
      //   如果next节点的key比插入节点小，则查找next节点是否存在
      //   next节点且比key大
      if (!(current === this.tail) && current.key < key) {
        prev = current
        continue
      }
      level--
    }

    // console.log(`${key} find times: ${times}`)

    return prev
  }

  findGreator () {

  }

  /**
   *
   * @param {string|Buffer} key
   * @returns {SkiplistNode} node
   */
  get (key) {
    let prev = this.fineLess(key)
    if (!prev) return null
    let current = prev.next()
    if (isEqual(current.key, key)) return current.value
    return null
  }

  /**
   *
   * @param {string|Buffer} key
   */
  del (key) {
    let update = new Array(this.maxlevel + 1)
    let prev = this.fineLess(key, update)
    if (!prev) return null
    let node = prev.next()
    if (!isEqual(node.key, key)) return

    for (let i = 0; i <= node.maxlevel; i++) {
      if (update[i]) {
        update[i].levels[i] = node.levels[i]
      }
    }
  }

  async * iterator () {

  }

  /**
   *
   * @param {string|Buffer} key
   * @param {string|Buffer} value
   */
  put (key, value) {
    let update = new Array(this.maxlevel + 1)
    let prev = this.fineLess(key, update)
    if (isEqual(prev.key, key)) {
      prev.value = value
    } else {
      const randomLevel = this.randomLevel()
      this.level = Math.max(randomLevel, this.level)
      // console.log(`randomLevel, ${randomLevel}`)
      const node = new SkiplistNode(randomLevel, prev.next(), key, value)

      for (let i = 0; i <= randomLevel; i++) {
        if (update[i]) {
          node.levels[i] = update[i].levels[i]
          update[i].levels[i] = node
        }
        // prev.levels[i] = node
      }
    }
  }

  length () {

  }
}

export default Skiplist
