/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { varint, assert } from "./DBHelper";
import { Buffer } from "./Buffer";
import { BlockHandle } from "./Format";

/**
 * fill in end of table, fixed 48 bytes，
 * include offset, size of data index block and meta index block
 *
 * read sstable from footer
 */
export default class TableFooter {
  static kEncodedLength = 48;

  constructor(buffer: Buffer) {
    assert(buffer.length === 48);
    this._buffer = buffer;
  }

  _buffer: Buffer;

  get indexHandle(): BlockHandle {
    const data = this.get();
    const handle = {
      offset: data.indexOffset,
      size: data.indexSize,
    } as BlockHandle;
    return handle;
  }

  get metaIndexHandle(): BlockHandle {
    const data = this.get();
    const handle = {
      offset: data.metaIndexOffset,
      size: data.metaIndexSize,
    } as BlockHandle;
    return handle;
  }

  get buffer(): Buffer {
    return this._buffer;
  }

  set metaIndexOffset(value: number) {
    const data = {
      ...this.get(),
      metaIndexOffset: value,
    };
    this.put(data);
  }

  set metaIndexSize(value: number) {
    const data = {
      ...this.get(),
      metaIndexSize: value,
    };
    this.put(data);
  }

  set indexOffset(value: number) {
    const data = {
      ...this.get(),
      indexOffset: value,
    };
    this.put(data);
  }

  set indexSize(value: number) {
    const data = {
      ...this.get(),
      indexSize: value,
    };
    this.put(data);
  }

  get(): {
    metaIndexOffset: number;
    metaIndexSize: number;
    indexOffset: number;
    indexSize: number;
  } {
    const buf = this.buffer;
    if (!buf) {
      return {
        metaIndexOffset: 0,
        metaIndexSize: 0,
        indexOffset: 0,
        indexSize: 0,
      };
    }
    let position = 0;
    const metaIndexOffset = varint.decode(buf, position);
    position += varint.decode.bytes;
    const metaIndexSize = varint.decode(buf, position);
    position += varint.decode.bytes;
    const indexOffset = varint.decode(buf, position);
    position += varint.decode.bytes;
    const indexSize = varint.decode(buf, position);
    return {
      metaIndexOffset,
      metaIndexSize,
      indexOffset,
      indexSize,
    };
  }

  put(data: {
    metaIndexOffset: number;
    metaIndexSize: number;
    indexOffset: number;
    indexSize: number;
  }): void {
    const handlers = Buffer.concat([
      Buffer.fromArrayLike(varint.encode(data.metaIndexOffset)),
      Buffer.fromArrayLike(varint.encode(data.metaIndexSize)),
      Buffer.fromArrayLike(varint.encode(data.indexOffset)),
      Buffer.fromArrayLike(varint.encode(data.indexSize)),
    ]);
    const paddingBuf = Buffer.alloc(40 - handlers.length);
    this._buffer = Buffer.concat([handlers, paddingBuf, Buffer.alloc(8)]);
  }
}
