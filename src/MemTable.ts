/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert'
import varint from 'varint'
import { Buffer } from 'buffer'
import {
  SequenceNumber,
  ValueType,
  InternalKeyComparator,
  LookupKey,
  Entry,
  InternalKey,
} from './Format'
import Skiplist from './Skiplist'
import Slice from './Slice'
import { decodeFixed64, getLengthPrefixedSlice } from './Coding'

export default class MemTable {
  static getValueSlice(key: Slice): Slice | null {
    const internalKeySize = varint.decode(key.buffer)
    const valueType = varint.decode(key.buffer.slice(internalKeySize))
    if (valueType === ValueType.kTypeDeletion) {
      return null
    }
    const valueBuffer = key.buffer.slice(varint.decode.bytes + internalKeySize)
    const valueSize = varint.decode(valueBuffer)
    const value = valueBuffer.slice(
      varint.decode.bytes,
      varint.decode.bytes + valueSize
    )
    return new Slice(value)
  }

  // key: <Buffer internalkeyzise><Buffer internalkey><Buffer valuesize><Buffer value>
  static getEntryFromMemTableKey(key: Slice): Entry {
    let index = 0

    const internalKeySize = varint.decode(key.buffer)
    index += varint.decode.bytes
    let internalKey = new Slice(
      key.buffer.slice(index, index + internalKeySize)
    )
    index += internalKeySize
    const valueSize = varint.decode(key.buffer.slice(index))
    index += varint.decode.bytes
    let value = new Slice(key.buffer.slice(index, index + valueSize))
    return { key: internalKey, value } as Entry
  }

  private _immutable: boolean
  private _list: Skiplist
  private _size: number
  refs: number
  internalKeyComparator: InternalKeyComparator

  constructor(internalKeyComparator: InternalKeyComparator) {
    this._immutable = false
    this.internalKeyComparator = internalKeyComparator
    this._list = new Skiplist(65535, this.keyComparator)
    this._size = 0
    this.refs = 0
  }

  keyComparator = (a: Slice, b: Slice): number => {
    const a1 = getLengthPrefixedSlice(a)
    const b1 = getLengthPrefixedSlice(b)
    return this.internalKeyComparator.compare(a1, b1)
  }

  ref() {
    this.refs++
  }

  unref() {
    this.refs--
  }

  get size(): number {
    return this._size
  }

  get immutable(): boolean {
    return this._immutable
  }

  set immutable(next: boolean) {
    if (next) this._immutable = true
  }

  add(
    sequence: SequenceNumber,
    valueType: ValueType,
    key: Slice,
    value?: Slice
  ) {
    const keySize = key.length
    const valueSize = !value ? 0 : value.length
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
    const sequenceBuf = sequence.toFixed64Buffer()
    sequenceBuf.fill(valueType, 7, 8)
    const buf = new Slice(
      Buffer.concat([
        internalKeySizeBuf,
        key.buffer,
        sequenceBuf,
        valueSizeBuf,
        !value ? Buffer.alloc(0) : value.buffer,
      ])
    )
    assert(encodedLength === buf.length, 'Incorrect length')
    // buf include both key and value
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
  //
  // this key is lookup key
  get(key: LookupKey): any {
    const memkey = key.memKey
    const result = this._list.get(memkey)
    if (!result) return result
    return MemTable.getValueSlice(result)
  }

  *iterator(): IterableIterator<Entry> {
    for (let value of this._list.iterator()) {
      yield MemTable.getEntryFromMemTableKey(value)
    }
  }
}
