/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert'
import varint from 'varint'
import Skiplist from './Skiplist'
import SequenceNumber from './SequenceNumber'

export default class MemTable {
  constructor (...props) {
    this._immutable = false
    this._list = new Skiplist()
  }

  _immutable:boolean
  _list:Skiplist

  // entry format is:
  //    klength  varint32
  //    userkey  char[klength]
  //    tag      uint64
  //    vlength  varint32
  //    value    char[vlength]
  // Check that it belongs to same user key.  We do not check the
  // sequence number since the Seek() call above should have skipped
  // all entries with overly large sequence numbers.
  get () {

  }

  add (sequence:SequenceNumber, valueType:string, key:string, value:string) {
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
    const buf = Buffer.concat([
      internalKeySizeBuf,
      Buffer.from(key),
      Buffer.from(sequence),
      valueSizeBuf,
      Buffer.from(value)
    ])
    assert(encodedLength === buf.length, 'Incorrect length')
    this._list.insert(buf)
  }

  * iterator () {

  }
}
