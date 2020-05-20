/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import varint from "../third_party/varint";
import { Buffer } from "../third_party/buffer";
import Slice from "./Slice";
import { FilterPolicy } from "./Options";
import { decodeFixed32 } from "./Coding";

// MetaBlock format is different with other blocks
// filter_index = (blockOffset / kFilterBase);
export default class SSTableFilterBlock {
  constructor(policy: FilterPolicy, data: Slice) {
    this._buffer = data.buffer;
    this._policy = policy;
    this._num = 0;
    this._baseLg = 0;

    const n = data.size;
    if (n < 5) return; // 1 byte for base_lg_ and 4 for start of offset array
    this._baseLg = data.buffer[data.length - 1];

    const lastWord = decodeFixed32(data.buffer.slice(n - 5));
    if (lastWord > n - 5) return;
    this._buffer = data.buffer;
    this._data = 0;
    this._offset = lastWord;
    this._num = (n - 5 - lastWord) / 4;
  }

  private _buffer: Buffer; //
  private _data!: number; // Pointer to filter data (at block-start)
  private _offset!: number; // Pointer to beginning of offset array (at block-end)
  private _size!: number;
  private _policy: FilterPolicy;
  private _num: number; // Number of entries in offset array
  private _baseLg: number; // Encoding parameter (see kFilterBaseLg in .cc file)

  get size(): number {
    return this._size;
  }

  get buffer(): Buffer {
    return this._buffer;
  }

  get beginningOfOffset(): number {
    let buf;
    if (this._offset === 0 && this._size === this._buffer.length) {
      buf = this._buffer;
    } else {
      buf = this._buffer.slice(this._offset, this._size);
    }
    return varint.decode(buf, buf.length - 2);
  }

  public keyMayMatch(blockOffset: number, key: Slice): boolean {
    const index = blockOffset >> this._baseLg;
    if (index < this._num) {
      const start = decodeFixed32(this._buffer.slice(this._offset + index * 4));
      const limit = decodeFixed32(
        this._buffer.slice(this._offset + index * 4 + 4),
      );

      if (start <= limit && limit <= this._offset + this._size) {
        const filter = new Slice(
          this._buffer.slice(
            this._offset + start,
            this._offset + limit - start,
          ),
        );
        return this._policy.keyMayMatch(key, filter);
      } else if (start == limit) {
        // Empty filters do not match any keys
        return false;
      }
    }
    return true; // Errors are treated as potential matches
  }
}
