/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { assert } from "./DBHelper";
import { Buffer } from "./Buffer";
import { crc32 } from "./Crc32";
import { kBlockSize, kHeaderSize, RecordType } from "./LogFormat";
import Slice from "./Slice";
import { FileHandle } from "./Env";

export default class LogWriter {
  constructor(file: FileHandle) {
    this._blockOffset = 0;
    this._file = file;
  }

  private _file!: FileHandle;
  private _blockOffset: number;

  private async appendFile(buf: Buffer): Promise<void> {
    await this._file.appendFile(buf, {});
  }

  public close = async (): Promise<void> => {
    assert(!!this._file);
    const file = this._file;
    delete this._file;
    try {
      await file.close();
    } catch (e) {}
  };

  private emitPhysicalRecord = async (
    record: Buffer,
    type: RecordType,
  ): Promise<void> => {
    const head = Buffer.alloc(kHeaderSize);
    const length = record.length;
    head[4] = length & 0xff;
    head[5] = length >> 8;
    head[6] = type;
    const merged = Buffer.concat([
      Buffer.bufferFrom([type]),
      record,
      Buffer.bufferFrom([record.length]),
    ]);
    const crc = crc32(merged);
    head.fill(crc, 0, 4);

    this._blockOffset += record.length + kHeaderSize;
    await this.appendFile(Buffer.concat([head, record]));
  };

  /**
   * Not care about record format
   */
  public addRecord = async (recordOp: Slice): Promise<void> => {
    let hasFirstRecordCreated = false;
    let left = recordOp.size;
    let position = 0;
    while (left > 0) {
      const leftover = kBlockSize - this._blockOffset;
      assert(leftover >= 0);
      if (leftover < kHeaderSize) {
        // Switch to a new block
        if (leftover > 0) {
          // Fill the trailer (literal below relies on kHeaderSize being 7)
          assert(kHeaderSize == 7);
          await this.appendFile(Buffer.alloc(leftover));
        }
        this._blockOffset = 0;
      }

      // Invariant: we never leave < kHeaderSize bytes in a block.
      assert(kBlockSize - this._blockOffset - kHeaderSize >= 0);

      const avail = kBlockSize - this._blockOffset - kHeaderSize;
      const fragmentLength = left < avail ? left : avail;

      let recordType: RecordType;
      const isEnd = left === fragmentLength;

      if (!hasFirstRecordCreated && isEnd) {
        recordType = RecordType.kFullType;
      } else if (!hasFirstRecordCreated) {
        recordType = RecordType.kFirstType;
      } else if (isEnd) {
        recordType = RecordType.kLastType;
      } else {
        recordType = RecordType.kMiddleType;
      }

      await this.emitPhysicalRecord(
        recordOp.buffer.slice(position, position + fragmentLength),
        recordType,
      );

      hasFirstRecordCreated = true;
      position += fragmentLength;
      left -= fragmentLength;
    }
  };
}
