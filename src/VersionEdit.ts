/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { InternalKey } from "./Format";
import {
  CompactPointer,
  DeletedFile,
  NewFile,
  FileMetaData,
} from "./VersionFormat";

export default class VersionEdit {
  // compact_pointer_ is a string  which record this level latest
  // compaction file's largest key，default is empty
  compactPointers: CompactPointer[];
  deletedFiles: DeletedFile[];
  newFiles: NewFile[];
  private _comparator: string;
  private _logNumber?: number;
  private _prevLogNumber?: number;
  private _lastLogNumber?: number;
  private _lastSequence?: bigint;
  private _nextFileNumber?: number;
  private _hasComparator?: boolean;
  private _hasLogNumber?: boolean;
  private _hasPrevLogNumber?: boolean;
  private _hasNextFileNumber?: boolean;
  private _hasLastSequence?: boolean;

  constructor() {
    this._comparator = "";
    this.deletedFiles = [];
    this.newFiles = [];
    this.compactPointers = [];
  }

  clear(): void {
    this.deletedFiles = [];
    this.newFiles = [];
    this.compactPointers = [];

    this._logNumber = 0;
    this._prevLogNumber = 0;
    this._lastSequence = 0n;
    // sstable file number
    this._nextFileNumber = 0;
    this._comparator = "";
    this._lastLogNumber = 0;
    this._hasComparator = false;
    this._hasLogNumber = false;
    this._hasPrevLogNumber = false;
    this._hasNextFileNumber = false;
    this._hasLastSequence = false;
  }

  set comparator(value: string) {
    this._comparator = value;
    this._hasComparator = true;
  }

  get comparator(): string {
    return this._comparator;
  }

  set logNumber(value: number) {
    this._logNumber = value;
    this._hasLogNumber = true;
  }

  get logNumber(): number {
    return this._logNumber || 0;
  }

  set prevLogNumber(value: number) {
    this._prevLogNumber = value;
    this._hasPrevLogNumber = true;
  }

  get prevLogNumber(): number {
    return this._prevLogNumber || 0;
  }

  set nextFileNumber(value: number) {
    this._nextFileNumber = value;
    this._hasNextFileNumber = true;
  }

  get nextFileNumber(): number {
    return this._nextFileNumber || 0;
  }

  set lastSequence(value: bigint) {
    this._lastSequence = value;
    this._hasLastSequence = true;
  }

  get lastSequence(): bigint {
    return this._lastSequence || 0n;
  }

  get hasComparator(): boolean {
    return this._hasComparator || false;
  }

  get hasLogNumber(): boolean {
    return this._hasLogNumber || false;
  }

  get hasPrevLogNumber(): boolean {
    return this._hasPrevLogNumber || false;
  }

  get hasNextFileNumber(): boolean {
    return this._hasNextFileNumber || false;
  }

  get hasLastSequence(): boolean {
    return this._hasLastSequence || false;
  }

  // Delete the specified "file" from the specified "level".
  public deleteFile(level: number, fileNum: number): void {
    this.deletedFiles.push({
      level,
      fileNum,
    });
  }

  // Add the specified file at the specified number.
  // REQUIRES: This version has not been saved (see VersionSet::SaveTo)
  // REQUIRES: "smallest" and "largest" are smallest and largest keys in file
  addFile(
    level: number,
    fileNum: number,
    fileSize: number,
    smallest: InternalKey,
    largest: InternalKey,
  ): void {
    const f = new FileMetaData();
    f.number = fileNum;
    f.fileSize = fileSize;
    f.smallest = smallest;
    f.largest = largest;
    this.newFiles.push({ level, fileMetaData: f });
  }

  setCompactPointer(level: number, internalKey: InternalKey): void {
    this.compactPointers.push({
      level,
      internalKey,
    });
  }
}
