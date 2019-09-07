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
import { Buffer } from 'buffer'
import { ValueType } from './Format'
import Skiplist from './Skiplist'
import Slice from './Slice'
import SequenceNumber from './SequenceNumber'
import { Encodings } from './Encodings'

export default class MemTable {
  static getLengthPrefixedSlice (key:Slice):Slice {
    const internalKeySize = varint.decode(key.buffer)
    const internalKeyBuffer = key.buffer.slice(0, internalKeySize)
    return new Slice(internalKeyBuffer)
  }

  static keyComparator (a:Slice, b:Slice):number {
    const a1 = MemTable.getLengthPrefixedSlice(a)
    const b1 = MemTable.getLengthPrefixedSlice(b)
    return a1.compare(b1)
  }

  static getValueSlice (key:Slice):Slice {
    const internalKeySize = varint.decode(key)
    const valueBuffer = key.buffer.slice(internalKeySize)
    const valueSize = varint.decode(valueBuffer)
    const value = valueBuffer.slice(valueSize)
    return new Slice(value)
  }

  static getValueWithEncoding (s:Slice, encoding:Encodings = 'string') {
    const valueSlice = MemTable.getValueSlice(s)
    if (encoding === 'string') return valueSlice.buffer.toString()
    if (encoding === 'json') return JSON.parse(valueSlice.buffer.toString())
    return valueSlice.buffer
  }

  constructor () {
    this._immutable = false
    this._list = new Skiplist(65535, MemTable.keyComparator)
    this._size = 0
  }

  _immutable:boolean
  _list:Skiplist
  _size: number

  get size ():number {
    return this._size
  }

  get immutable (): boolean {
    return this._immutable
  }

  set immutable (next: boolean) {
    if (next) this._immutable = true
  }

  add (sequence:SequenceNumber, valueType:ValueType, key:Slice, value:Slice) {
    const keySize = key.length
    const valueSize = value.length
    const internalKeySize = keySize + 8 // sequence=7bytes, type = 1byte
    const valueSizeBuf = Buffer.from(varint.encode(valueSize))
    let encodedLength = internalKeySize + valueSize + varint.encode.bytes
    const internalKeySizeBuf = Buffer.from(varint.encode(internalKeySize))
    encodedLength += varint.encode.bytes

    /**
     * encoded(internal_key_size) | key | sequence(7Bytes) | type (1Byte) | encoded(value_size) | value
     * 1. Lookup key/ Memtable Key: encoded(internal_key_size) --- type(1Byte)
     * 2. Internal key: key --- type(1Byte)
     * 3. User key: key
     */
    const buf = new Slice(Buffer.concat([
      internalKeySizeBuf,
      key.buffer,
      sequence.toFixedSizeBuffer(),
      Buffer.from(varint.encode(valueType.value)),
      valueSizeBuf,
      value.buffer
    ]))
    assert(encodedLength === buf.length, 'Incorrect length')
    // buf包含key和value
    this._list.put(buf)
    this._size += buf.length
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
  // 这里的key是lookup key
  get (key:Slice, encoding:Encodings = 'string'):any {
    const result = this._list.get(key)
    if (!result) return result
    return MemTable.getValueWithEncoding(result, encoding)
  }

  * iterator (encoding:Encodings):Generator<any, void, void> {
    let iterator = this._list.iterator()
    let result = iterator.next()
    while (!result.done) {
      yield MemTable.getValueWithEncoding(result.value)
      result = iterator.next()
    }
  }
}
