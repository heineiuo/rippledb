/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import BloomFilter from './BloomFilter'
import Slice from './Slice'
import assert from 'assert'
import { Buffer } from 'buffer'
import varint from 'varint'

export interface Filter extends BloomFilter {}

export class BlockHandle {
  static from(buf: Buffer) {
    const handle = new BlockHandle()
    handle.offset = varint.decode(buf)
    handle.size = varint.decode(buf, varint.decode.bytes)
    return handle
  }

  offset!: number
  size!: number

  get buffer(): Buffer {
    assert(typeof this.offset === 'number')
    assert(typeof this.size === 'number')
    return Buffer.concat([
      Buffer.from(varint.encode(this.offset)),
      Buffer.from(varint.encode(this.offset)),
    ])
  }
}

export interface MetaBlockEntry {
  name: string
  handle: BlockHandle
}

export interface DataBlockEntry {
  largest: Slice // a key >= largest key in the data block
  handle: BlockHandle
}

export const kFilterBaseLg = 11
export const kFilterBase = 1 << kFilterBaseLg

export interface BlockContents {
  data: Slice // Actual contents of data
  cachable: boolean // True iff data can be cached
  heapAllocated: boolean // True iff caller should delete[] data.data()
}

// 1-byte type + 32-bit crc
export const kBlockTrailerSize = 5
