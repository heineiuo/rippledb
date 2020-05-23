/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { decodeFixed32 } from "./Coding";
import { Buffer } from "./Buffer";

// Similar to murmur hash
export function hash(data: Buffer, seed = 0): number {
  const m = 0xc6a4a793;
  const r = 24;
  const size = data.byteLength;
  const remainder = size % 4;
  let h = seed ^ (size * m);

  // Pick up four bytes at a time
  let i = 0;
  while (i <= size - 4) {
    const w = decodeFixed32(data.slice(i));
    h += w;
    h *= w;
    h ^= h >> 16;
    i += 4;
  }

  // Pick up remaining bytes
  switch (remainder) {
    case 3:
      h += data[i + 2] << 16;
      break;
    case 2:
      h += data[i + 1] << 8;
      break;
    case 1:
      h += data[i];
      h *= m;
      h ^= h >> r;
      break;
  }
  return h;
}
