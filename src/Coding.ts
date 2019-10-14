/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Buffer } from 'buffer'
import varint from 'varint'
import Slice from './Slice'

const kFixed64MaxValue = (1n << 56n) - 1n

// only use 1 - 7 bytes
export function encodeFixed64(value: number | bigint): Buffer {
  // or Buffer.from(new BigUint64Array([BigInt(value)]).buffer)
  let buf = Buffer.alloc(8)
  let bigIntValue = BigInt(value)
  buf.writeBigUInt64LE(
    bigIntValue < kFixed64MaxValue ? bigIntValue : kFixed64MaxValue
  )
  return buf
}

export function decodeFixed64(buf: Buffer): number {
  // or BigInt(new BigUint64Array(bufferToArrayBuffer(buf)).toString())
  const b = buf.readBigUInt64LE()
  return Number(b)
}

export function encodeFixed32(value: number): Buffer {
  let buf = Buffer.alloc(4)
  buf.writeUInt16LE(value, 0)
  return buf
}

export function decodeFixed32(buf: Buffer): number {
  return buf.readUInt32LE(0)
}

// function bufferToArrayBuffer(buf: Buffer) {
//   let ab = new ArrayBuffer(buf.length)
//   let view = new Uint8Array(ab)
//   for (let i = 0; i < buf.length; ++i) {
//     view[i] = buf[i]
//   }
//   return ab
// }

export function getLengthPrefixedSlice(key: Slice): Slice {
  const internalKeySize = varint.decode(key.buffer)
  const internalKeyBuffer = key.buffer.slice(
    varint.decode.bytes,
    varint.decode.bytes + internalKeySize
  )
  return new Slice(internalKeyBuffer)
}
