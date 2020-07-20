/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Buffer } from "./Buffer";
import { varint, assert } from "./DBHelper";
import Slice from "./Slice";

const kFixed64MaxValue = (1n << 56n) - 1n;

// only use 1 - 7 bytes
export function encodeFixed64(value: number | bigint): Buffer {
  // or Buffer.from(new BigUint64Array([BigInt(value)]).buffer)
  const buf = Buffer.alloc(8);
  const bigIntValue = BigInt(value);
  buf.writeBigUInt64LE(
    bigIntValue < kFixed64MaxValue ? bigIntValue : kFixed64MaxValue,
  );
  return buf;
}

export function decodeFixed64(buf: Buffer): bigint {
  // or BigInt(new BigUint64Array(bufferToArrayBuffer(buf)).toString())
  return buf.readBigUInt64LE();
}

export function encodeFixed32(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value, 0);
  return buf;
}

export function decodeFixed32(buf: Buffer): number {
  assert(buf.length >= 4);
  return buf.readUInt32LE(0);
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
  const internalKeySize = varint.decode(key.buffer);
  const internalKeyBuffer = key.buffer.slice(
    varint.decode.bytes,
    varint.decode.bytes + internalKeySize,
  );
  return new Slice(internalKeyBuffer);
}
