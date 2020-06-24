/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BytewiseComparator } from "./Comparator";
import BloomFilter from "./BloomFilter";
import { Comparator } from "./Comparator";
import Slice from "./Slice";
import { Env, FileHandle } from "./Env";
import Block from "./SSTableBlock";
import Cache from "./Cache";
import { Buffer } from "./Buffer";
import { Snapshot } from "./Snapshot";

export interface FilterPolicy {
  name(): string;
  keyMayMatch(key: Slice, filter: Slice): boolean;
}

export interface ReadOptions {
  // If true, all data read from underlying storage will be
  // verified against corresponding checksums.
  verifyChecksums?: boolean;

  // Should the data read for this iteration be cached in memory?
  // Callers may wish to set this field to false for bulk scans.
  fillCache?: boolean;

  // If "snapshot" is non-null, read as of the supplied snapshot
  // (which must belong to the DB that is being read and which must
  // not have been released).  If "snapshot" is null, use an implicit
  // snapshot of the state at the beginning of this read operation.
  snapshot?: Snapshot;
}

export const defaultReadOptions: Omit<Required<ReadOptions>, "snapshot"> = {
  verifyChecksums: false,
  fillCache: true,
};

export interface IteratorOptions extends ReadOptions {
  reverse?: boolean;
  start?: string | Buffer;
}

export const defaultIteratorOptions: Omit<
  Required<IteratorOptions>,
  "snapshot"
> = {
  reverse: false,
  start: Buffer.alloc(0),
  ...defaultReadOptions,
};

export interface WriteOptions {
  // If true, the write will be flushed from the operating system
  // buffer cache (by calling WritableFile::Sync()) before the write
  // is considered complete.  If this flag is true, writes will be
  // slower.
  //
  // If this flag is false, and the machine crashes, some recent
  // writes may be lost.  Note that if it is just the process that
  // crashes (i.e., the machine does not reboot), no writes will be
  // lost even if sync==false.
  //
  // In other words, a DB write with sync==false has similar
  // crash semantics as the "write()" system call.  A DB write
  // with sync==true has similar crash semantics to a "write()"
  // system call followed by "fsync()".
  sync?: boolean;
}

export const defaultWriteOptions: Required<WriteOptions> = {
  sync: false,
};

export interface DatabaseOptions {
  // Comparator used to define the order of keys in the table.
  // Default: a comparator that uses lexicographic byte-wise ordering
  //
  // REQUIRES: The client must ensure that the comparator supplied
  // here has the same name and orders keys *exactly* the same as the
  // comparator provided to previous open calls on the same DB.
  comparator?: Comparator;

  // Amount of data to build up in memory (backed by an unsorted log
  // on disk) before converting to a sorted on-disk file.
  //
  // Larger values increase performance, especially during bulk loads.
  // Up to two write buffers may be held in memory at the same time,
  // so you may wish to adjust this parameter to control memory usage.
  // Also, a larger write buffer will result in a longer recovery time
  // the next time the database is opened.
  writeBufferSize?: number;

  // Leveldb will write up to this amount of bytes to a file before
  // switching to a new one.
  // Most clients should leave this parameter alone.  However if your
  // filesystem is more efficient with larger files, you could
  // consider increasing the value.  The downside will be longer
  // compactions and hence longer latency/performance hiccups.
  // Another reason to increase this parameter might be when you are
  // initially populating a large database.
  maxFileSize?: number;

  // Number of open files that can be used by the DB.  You may need to
  // increase this if your database has a large working set (budget
  // one open file per 2MB of working set).
  maxOpenFiles?: number;

  // automatically create and use an 8MB internal cache.
  // 8MB = 2048 * blockSize(4096B)
  blockCache?: Cache<Buffer, Block>;

  // Approximate size of user data packed per block.  Note that the
  // block size specified here corresponds to uncompressed data.  The
  // actual size of the unit read from disk may be smaller if
  // compression is enabled.  This parameter can be changed dynamically.
  blockSize?: number;

  // Number of keys between restart points for delta encoding of keys.
  // This parameter can be changed dynamically.  Most clients should
  // leave this parameter alone.
  blockRestartInterval?: number;

  // EXPERIMENTAL: If true, append to existing MANIFEST and log files
  // when a database is opened.  This can significantly speed up open.
  //
  // Default: currently false, but may become true later.
  reuseLogs?: boolean;

  filterPolicy?: FilterPolicy;

  debug?: boolean;

  lockfileStale?: number;

  env?: Env;

  log?: (message: string) => Promise<void>;

  infoLog?: FileHandle | null;
}

export type Options = Required<DatabaseOptions>;

export const defaultOptions: Omit<Required<Options>, "env"> = {
  comparator: new BytewiseComparator(),
  writeBufferSize: 4 * 1024 * 1024,
  maxFileSize: 2 * 1024 * 1024,
  maxOpenFiles: 1000,
  blockCache: new Cache<Buffer, Block>({
    max: 2048,
  }),
  blockSize: 4 * 1024,
  blockRestartInterval: 16,
  reuseLogs: false,
  filterPolicy: new BloomFilter(),
  debug: false,
  lockfileStale: 10000,
  infoLog: null,
  async log(message: string): Promise<void> {
    if (this.infoLog) await this.infoLog.appendFile(message);
  },
};
