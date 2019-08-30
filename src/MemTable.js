/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @flow
/* global Generator */

import assert from 'assert'
import varint from 'varint'
import Skiplist from './Skiplist'
import Slice from './Slice'
import SequenceNumber from './SequenceNumber'

export default class MemTable {
  constructor () {
    this._immutable = false
    this._list = new Skiplist(65535, comparator)
  }

  _immutable:boolean
  _list:Skiplist

  add (sequence:SequenceNumber, valueType:string, key:Slice, value:Slice) {
    const keySize = key.length
    const valueSize = value.length
    const internalKeySize = keySize + 8
    let encodedLength = 0
    const internalKeySizeBuf = varint.encode(internalKeySize)
    encodedLength += varint.encode.bytes
    encodedLength += internalKeySize
    const valueSizeBuf = varint.encode(valueSize)
    encodedLength += varint.encode.bytes
    encodedLength += valueSize
    const buf = new Slice(Buffer.concat([
      internalKeySizeBuf,
      key.buffer,
      sequence.toBuffer(),
      valueSizeBuf,
      value.buffer
    ]))
    assert(encodedLength === buf.length, 'Incorrect length')
    // buf包含key和value
    this._list.put(buf)
  }

  // entry format is:
  //    klength  varint32
  //    userkey  char[klength]
  //    tag      uint64
  //    vlength  varint32
  //    value    char[vlength]
  // Check that it belongs to same user key.  We do not check the
  // sequence number since the Seek() call above should have skipped
  // all entries with overly large sequence numbers.
  get (key:string):Slice {
    // TODO 这里的key是lookup key
    const result = this._list.iterator()
  }

  * iterator ():Generator<any, void, void> {

  }
}

function comparator (a:Slice, b:Slice):number {

}
