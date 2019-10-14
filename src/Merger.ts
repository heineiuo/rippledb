/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert'
import { Entry, InternalKeyComparator } from './Format'

export default class IteratorMerger {
  constructor(
    icmp: InternalKeyComparator,
    list: AsyncIterableIterator<Entry>[],
    num: number
  ) {
    this._icmp = icmp
    this._list = list
    this._num = num
  }

  private _icmp: InternalKeyComparator
  private _list: AsyncIterableIterator<Entry>[]
  private _num: number

  public async *iterator(): AsyncIterableIterator<Entry> {
    assert(this._num >= 0)
    if (this._num === 0) return
    if (this._num === 1) yield* this._list[0]
    let smallest = await this.findSmallest(this._list)
    if (!smallest) return
    yield smallest
  }

  private async findSmallest(
    list: AsyncIterableIterator<Entry>[]
  ): Promise<Entry | null> {
    let smallest = null
    for (let i = 0; i < this._num; i++) {
      const child = await this._list[i].next()
      if (!child.done) {
        if (smallest === null) {
          smallest = child.value
        } else if (this._icmp.compare(child.value.key, smallest.key) < 0) {
          smallest = child.value
        }
      }
    }
    return smallest
  }
}
