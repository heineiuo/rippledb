/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { crc32 } from "./Crc32";
import { Buffer } from "./Buffer";
import { assert, varint } from "./DBHelper";
import Slice from "./Slice";
import { InternalKey, VersionEditTag } from "./Format";
import VersionEdit from "./VersionEdit";
import { FileMetaData, NewFile } from "./VersionFormat";
import { createHexStringFromDecimal } from "./LogFormat";

export default class VersionEditRecord {
  static from(buf: Buffer): VersionEditRecord {
    const length = buf.readUInt16BE(4);
    const type = buf.readUInt8(6);
    const data = new Slice(buf.slice(7, 7 + length));
    assert(length === data.length);
    const record = new VersionEditRecord(type, data);
    return record;
  }

  static add(edit: VersionEdit): Slice {
    const bufList: Buffer[] = [];
    if (edit.hasComparator) {
      bufList.push(Buffer.fromArrayLike([VersionEditTag.kComparator]));
      bufList.push(Buffer.fromArrayLike(varint.encode(edit.comparator.length)));
      bufList.push(Buffer.bufferFrom(edit.comparator));
    }
    if (edit.hasLogNumber) {
      bufList.push(Buffer.fromArrayLike([VersionEditTag.kLogNumber]));
      bufList.push(Buffer.fromArrayLike(varint.encode(edit.logNumber)));
    }
    if (edit.hasPrevLogNumber) {
      bufList.push(Buffer.fromArrayLike([VersionEditTag.kPrevLogNumber]));
      bufList.push(Buffer.fromArrayLike(varint.encode(edit.prevLogNumber)));
    }
    if (edit.hasNextFileNumber) {
      bufList.push(Buffer.fromArrayLike([VersionEditTag.kNextFileNumber]));
      bufList.push(Buffer.fromArrayLike(varint.encode(edit.nextFileNumber)));
    }
    if (edit.hasLastSequence) {
      bufList.push(Buffer.fromArrayLike([VersionEditTag.kLastSequence]));
      bufList.push(Buffer.fromArrayLike(varint.encode(edit.lastSequence)));
    }
    edit.compactPointers.forEach(
      (pointer: { level: number; internalKey: Slice }) => {
        bufList.push(Buffer.fromArrayLike([VersionEditTag.kCompactPointer]));
        bufList.push(Buffer.fromArrayLike(varint.encode(pointer.level)));
        bufList.push(
          Buffer.fromArrayLike(varint.encode(pointer.internalKey.length)),
        );
        bufList.push(pointer.internalKey.buffer);
      },
    );

    edit.deletedFiles.forEach((file: { level: number; fileNum: number }) => {
      bufList.push(Buffer.fromArrayLike([VersionEditTag.kDeletedFile]));
      bufList.push(Buffer.fromArrayLike(varint.encode(file.level)));
      bufList.push(Buffer.fromArrayLike(varint.encode(file.fileNum)));
    });

    edit.newFiles.forEach((file: NewFile) => {
      bufList.push(Buffer.fromArrayLike([VersionEditTag.kNewFile]));
      bufList.push(Buffer.fromArrayLike(varint.encode(file.level)));
      bufList.push(
        Buffer.fromArrayLike(varint.encode(file.fileMetaData.number)),
      );
      bufList.push(
        Buffer.fromArrayLike(varint.encode(file.fileMetaData.fileSize)),
      );
      bufList.push(
        Buffer.fromArrayLike(varint.encode(file.fileMetaData.smallest.length)),
      );
      bufList.push(file.fileMetaData.smallest.buffer);
      bufList.push(
        Buffer.fromArrayLike(varint.encode(file.fileMetaData.largest.length)),
      );
      bufList.push(file.fileMetaData.largest.buffer);
    });

    return new Slice(Buffer.concat(bufList));
  }

  static decode(opSlice: Slice): VersionEdit {
    let index = 0;
    const edit = new VersionEdit();
    const opBuffer = opSlice.buffer;
    while (index < opSlice.length) {
      const type = opBuffer.readUInt8(index);
      index += 1;

      if (type === VersionEditTag.kComparator) {
        const comparatorNameLength = varint.decode(opBuffer.slice(index));
        index += varint.decode.bytes;
        const comparatorName = opBuffer.slice(
          index,
          index + comparatorNameLength,
        );
        index += comparatorNameLength;
        edit.comparator = comparatorName.toString();
        continue;
      } else if (type === VersionEditTag.kLogNumber) {
        const logNumber = varint.decode(opBuffer.slice(index));
        index += varint.decode.bytes;
        edit.logNumber = logNumber;
        continue;
      } else if (type === VersionEditTag.kPrevLogNumber) {
        const prevLogNumber = varint.decode(opBuffer.slice(index));
        index += varint.decode.bytes;
        edit.prevLogNumber = prevLogNumber;
        continue;
      } else if (type === VersionEditTag.kNextFileNumber) {
        const nextFileNumber = varint.decode(opBuffer.slice(index));
        index += varint.decode.bytes;
        edit.nextFileNumber = nextFileNumber;
        continue;
      } else if (type === VersionEditTag.kLastSequence) {
        const lastSequence = varint.decode(opBuffer.slice(index));
        index += varint.decode.bytes;
        edit.lastSequence = lastSequence;
        continue;
      } else if (type === VersionEditTag.kCompactPointer) {
        const level = varint.decode(opBuffer.slice(index));
        index += varint.decode.bytes;
        const internalKeyLength = varint.decode(opBuffer.slice(index));
        index += varint.decode.bytes;
        assert(opBuffer.length >= index + internalKeyLength);
        const internalKey = new Slice(
          opBuffer.slice(index, index + internalKeyLength),
        );
        index += internalKeyLength;
        edit.compactPointers.push({
          level,
          internalKey: new InternalKey(internalKey),
        });
        continue;
      } else if (type === VersionEditTag.kDeletedFile) {
        const level = varint.decode(opBuffer.slice(index));
        index += varint.decode.bytes;
        const fileNum = varint.decode(opBuffer.slice(index));
        index += varint.decode.bytes;
        edit.deletedFiles.push({
          level,
          fileNum,
        });
        continue;
      } else if (type === VersionEditTag.kNewFile) {
        const level = varint.decode(opBuffer.slice(index));
        index += varint.decode.bytes;
        const fileNum = varint.decode(opBuffer.slice(index));
        index += varint.decode.bytes;
        const fileSize = varint.decode(opBuffer.slice(index));
        index += varint.decode.bytes;
        const smallestKeyLength = varint.decode(opBuffer.slice(index));
        index += varint.decode.bytes;
        const smallestKey = opBuffer.slice(index, index + smallestKeyLength);
        index += smallestKeyLength;
        const largestKeyLength = varint.decode(opBuffer.slice(index));
        index += varint.decode.bytes;
        const largestKey = opBuffer.slice(index, index + largestKeyLength);
        index += largestKeyLength;
        const fileMetaData = new FileMetaData();
        fileMetaData.number = fileNum;
        fileMetaData.fileSize = fileSize;
        fileMetaData.smallest = InternalKey.from(new Slice(smallestKey));
        fileMetaData.largest = InternalKey.from(new Slice(largestKey));

        edit.newFiles.push({
          level,
          fileMetaData,
        });
        continue;
      }
    }
    return edit;
  }

  constructor(type: VersionEditTag, data: Slice | Buffer) {
    this.type = type;
    this.data = new Slice(data);
  }

  get length(): number {
    return this.data.length + 7;
  }

  get size(): number {
    return this.length;
  }

  data: Slice;
  type: VersionEditTag;

  get buffer(): Buffer {
    const lengthBuf = Buffer.fromHex(
      createHexStringFromDecimal(this.data.length),
    );
    const typeBuf = Buffer.fromArrayLike([this.type]);
    const sum = crc32(Buffer.concat([typeBuf, this.data.buffer]));
    return Buffer.concat([sum, lengthBuf, typeBuf, this.data.buffer]);
  }
}
