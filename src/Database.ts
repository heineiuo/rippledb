/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { path, assert } from "./DBHelper";
import { Buffer } from "./Buffer";
import MemTable from "./MemTable";
import LogWriter from "./LogWriter";
import {
  defaultOptions,
  defaultWriteOptions,
  Options,
  DatabaseOptions,
  ReadOptions,
  WriteOptions,
  IteratorOptions,
  defaultIteratorOptions,
} from "./Options";
import IteratorHelper from "./IteratorHelper";
import {
  ValueType,
  Config,
  FileType,
  InternalKeyComparator,
  parseInternalKey,
  ParsedInternalKey,
  InternalKey,
  SequenceNumber,
  kValueTypeForSeek,
  LookupKey,
  Entry,
} from "./Format";
import { FileMetaData, GetStats } from "./VersionFormat";
import Version from "./Version";
import Compaction, {
  CompactionState,
  CompactionStateOutput,
  CompactionStats,
} from "./Compaction";
import Slice from "./Slice";
import VersionSet from "./VersionSet";
import VersionEdit from "./VersionEdit";
import VersionEditRecord from "./VersionEditRecord";
import {
  parseFilename,
  getCurrentFilename,
  getLogFilename,
  getManifestFilename,
  getTableFilename,
  getOldInfoLogFilename,
  getInfoLogFilename,
  getLockFilename,
} from "./Filename";
import { WriteBatch, WriteBatchInternal } from "./WriteBatch";
import Status from "./Status";
import SSTableBuilder from "./SSTableBuilder";
import { BytewiseComparator, Comparator } from "./Comparator";
import { FileHandle, Dirent } from "./Env";
import { TableCache, TableAndFile } from "./SSTableCache";
import { Snapshot, SnapshotList } from "./Snapshot";
import LogReader from "./LogReader";
import IteratorMerger from "./Merger";
import { WriterQueue, Writer } from "./WriterQueue";
import { Lockfile } from "./Lockfile";

// Information for a manual compaction
interface ManualCompaction {
  level: number;
  done: boolean;
  begin: InternalKey; // null means beginning of key range
  end: InternalKey; // null means end of key range
  tmpStorage: InternalKey; // Used to keep track of compaction progress
}

interface RecoverResult {
  edit: VersionEdit;
  saveManifest: boolean;
}

interface RecoverLogFileResult {
  saveManifest?: boolean;
}

const kNumNonTableCacheFiles = 10;

function getTableCacheSize(sanitizedOptions: Options): number {
  // Reserve ten files or so for other uses and give the rest to TableCache.
  return sanitizedOptions.maxOpenFiles - kNumNonTableCacheFiles;
}

export default class Database {
  constructor(dbpath: string, options: DatabaseOptions = {}) {
    if (!options.env) throw new Error("env required");
    const env = options.env;
    this._backgroundCompactionScheduled = false;
    this._internalKeyComparator = new InternalKeyComparator(
      new BytewiseComparator(),
    );
    this._dbpath = dbpath;
    // this._memtable = new MemTable(this._internalKeyComparator)
    this._sn = new SequenceNumber(0);
    this.pendingOutputs = new Set();
    this._stats = Array.from(
      { length: Config.kNumLevels },
      () => new CompactionStats(),
    );

    options.comparator = this._internalKeyComparator;
    this._options = { ...defaultOptions, ...options, env };
    this.lockfile = new Lockfile(getLockFilename(dbpath), this._options);

    this._tableCache = new TableCache(
      dbpath,
      this._options,
      getTableCacheSize(this._options),
    );

    this._versionSet = new VersionSet(
      this._dbpath,
      this._options,
      this._tableCache,
      this._internalKeyComparator,
    );

    this._status = new Status(this.recoverWrapper());
    this._snapshots = new SnapshotList();
  }

  private writers = new WriterQueue();
  private tmpBatch = new WriteBatch();
  private _internalKeyComparator: InternalKeyComparator;
  private _backgroundCompactionScheduled: boolean;
  private _dbpath: string;
  private _sn: SequenceNumber;
  private _ok = false;
  private _status: Status;
  private _log!: LogWriter;
  private _logFileNumber = 0;
  private _memtable!: MemTable;
  private _immtable!: MemTable;
  private _versionSet: VersionSet;
  private _manualCompaction!: ManualCompaction | null;
  private _bgError!: Status;
  private pendingOutputs: Set<number>;
  private _snapshots: SnapshotList;
  private _stats: CompactionStats[];
  private _options: Options;
  private _tableCache: TableCache;
  private lockfile: Lockfile;

  private get userComparator(): Comparator {
    return this._internalKeyComparator.userComparator;
  }

  private async shouldInit(): Promise<boolean> {
    const currentName = getCurrentFilename(this._dbpath);
    let should = false;
    try {
      await this._options.env.access(this._dbpath);
    } catch (e) {
      should = true;
      await this._options.env.mkdir(this._dbpath);
    }

    await this.lockfile.lock();
    try {
      await this._options.env.access(currentName);
    } catch (e) {
      should = true;
    }
    return should;
  }

  // new db
  private async initVersionEdit(): Promise<void> {
    const edit = new VersionEdit();
    edit.comparator = this._internalKeyComparator.userComparator.getName();
    edit.logNumber = 0;
    edit.nextFileNumber = 2;
    edit.lastSequence = 0;
    const writer = new LogWriter(
      await this._options.env.open(getManifestFilename(this._dbpath, 1), "a"),
    );
    await writer.addRecord(VersionEditRecord.add(edit));
    await writer.close();
    await this._options.env.writeFile(
      getCurrentFilename(this._dbpath),
      "MANIFEST-000001\n",
    );
  }

  private async recoverWrapper(): Promise<void> {
    try {
      let status = new Status(this.recover());
      let edit = {} as VersionEdit;
      let saveManifest = false;
      if (await status.ok()) {
        const result = (await status.promise) as RecoverResult;
        edit = result.edit;
        saveManifest = result.saveManifest;
      } else {
        throw status.error;
      }
      if ((await status.ok()) && !this._memtable) {
        // Create new log and a corresponding memtable.
        const newLogNumber = this._versionSet.getNextFileNumber();
        edit.logNumber = newLogNumber;
        this._logFileNumber = newLogNumber;
        if (!!this._log) {
          await this._log.close();
          delete this._log;
        }
        this._log = new LogWriter(
          await this._options.env.open(
            getLogFilename(this._dbpath, newLogNumber),
            "a",
          ),
        );
        this._memtable = new MemTable(this._internalKeyComparator);
        this._memtable.ref();
      }

      if ((await status.ok()) && saveManifest) {
        edit.prevLogNumber = 0; // No older logs needed after recovery.
        edit.logNumber = this._logFileNumber;
        status = await this._versionSet.logAndApply(edit);
      }

      if (await status.ok()) {
        await this.deleteObsoleteFiles();
        await this.maybeScheduleCompaction();
        assert(!!this._memtable);
      }
      if (!(await status.ok())) {
        throw status.error;
      }
    } catch (e) {
      if (this._options.debug) {
        this._options.log(`DEBUG DB recover fail`);
      }
      throw e;
    }
  }

  private async recover(): Promise<RecoverResult> {
    const result: RecoverResult = {
      saveManifest: false,
      edit: new VersionEdit(),
    };
    if (await this.shouldInit()) {
      await this.initVersionEdit();
    } else {
      try {
        await this._options.env.rename(
          getInfoLogFilename(this._dbpath),
          getOldInfoLogFilename(this._dbpath),
        );
      } catch (e) {}
    }

    this._options.infoLog = await this._options.env.open(
      getInfoLogFilename(this._dbpath),
      "a+",
    );

    const versionSetRecoverResult = await this._versionSet.recover();
    if (typeof versionSetRecoverResult.saveManifest === "boolean") {
      result.saveManifest = versionSetRecoverResult.saveManifest;
    }

    const maxSequence = new SequenceNumber(0);
    // Recover from all newer log files than the ones named in the
    // descriptor (new log files may have been added by the previous
    // incarnation without registering them in the descriptor).
    //
    // Note that PrevLogNumber() is no longer used, but we pay
    // attention to it in case we are recovering a database
    // produced by an older version of leveldb.
    const minLog = this._versionSet.logNumber;
    const prevLog = this._versionSet.prevLogNumber;
    const filenames = (await this._options.env.readdir(this._dbpath)).reduce(
      (filenames: string[], dirent: Dirent) => {
        if (dirent.isFile()) {
          filenames.push(dirent.name);
        }
        return filenames;
      },
      [],
    );
    const expected: Set<number> = new Set();
    this._versionSet.addLiveFiles(expected);
    let logs = [];
    for (const filename of filenames) {
      const internalFile = parseFilename(filename);
      if (internalFile.isInternalFile) {
        expected.delete(internalFile.number);
        if (
          internalFile.type == FileType.kLogFile &&
          (internalFile.number >= minLog || internalFile.number === prevLog)
        ) {
          logs.push(internalFile.number);
        }
      }
    }

    if (expected.size > 0) {
      throw new Error(`${expected.size} missing files; e.g.`);
    }

    const edit = result.edit;

    // Recover in the order in which the logs were generated
    logs = logs.sort();
    for (let i = 0; i < logs.length; i++) {
      const result2: RecoverLogFileResult = await this.recoverLogFile(
        logs[i],
        i === logs.length - 1,
        edit,
        maxSequence,
      );
      if (typeof result2.saveManifest === "boolean") {
        result.saveManifest = result2.saveManifest;
      }

      // The previous incarnation may not have written any MANIFEST
      // records after allocating this log number.  So we manually
      // update the file number allocation counter in VersionSet.
      this._versionSet.markFileNumberUsed(logs[i]);
    }

    if (this._versionSet.lastSequence < maxSequence.value) {
      this._versionSet.lastSequence = maxSequence.value;
    }

    return result;
  }

  private async recoverLogFile(
    logNumber: number,
    isLastLog: boolean,
    edit: VersionEdit,
    maxSequence: SequenceNumber,
  ): Promise<RecoverLogFileResult> {
    const result = {} as RecoverLogFileResult;
    let status = new Status();
    // Open the log file
    const logFilename = getLogFilename(this._dbpath, logNumber);
    const reader = new LogReader(
      await this._options.env.open(logFilename, "r"),
    );
    this._options.log(`Recovering log #${logNumber}`);
    let compactions = 0;
    let mem = null;
    for await (const record of reader.iterator()) {
      if (record.size < 12) {
        this._options.log(
          ` ${logFilename} log record too small: dropping ${record.size} bytes`,
        );
        continue;
      }

      const batch = new WriteBatch();
      WriteBatchInternal.setContents(batch, record.buffer);
      if (!mem) {
        mem = new MemTable(this._internalKeyComparator);
        mem.ref();
      }
      WriteBatchInternal.insert(batch, mem);
      const lastSeq =
        WriteBatchInternal.getSequence(batch).value +
        WriteBatchInternal.getCount(batch) -
        1;

      if (lastSeq > maxSequence.value) {
        maxSequence.value = lastSeq;
      }

      if (mem.size > this._options.writeBufferSize) {
        compactions++;
        result.saveManifest = true;
        status = await this.writeLevel0Table(mem, edit);
        mem.unref();
        mem = null;
        if (!(await status.ok())) {
          break;
        }
      }
    }

    if (this._options.reuseLogs && isLastLog && compactions === 0) {
      // TODO
    }

    if (!!mem) {
      // mem did not get reused; compact it.
      if (await status.ok()) {
        result.saveManifest = true;
        status = await this.writeLevel0Table(mem, edit);
      }
      mem.unref();
    }

    return result;
  }

  // wait for db.recover
  public async ok(): Promise<boolean> {
    if (await this._status.ok()) {
      this._ok = true;
      return true;
    } else {
      this._ok = false;
      throw this._status.error;
    }
  }

  // TODO
  public async destroy(): Promise<void> {
    await this.lockfile.unlock();
    if (this._options.infoLog) {
      await this._options.infoLog.close();
    }
    if (this._log) {
      this._log.close();
    }
    await this._tableCache.destroy();
  }

  public async *iterator(
    options: IteratorOptions = {},
  ): AsyncIterableIterator<{ key: Uint8Array; value: Uint8Array }> {
    if (!this._ok) await this.ok();

    const sequence = options.snapshot
      ? new Snapshot(options.snapshot).sequenceNumber
      : new SequenceNumber(this._versionSet.lastSequence);
    const iteratorOptions: Omit<Required<IteratorOptions>, "snapshot"> = {
      ...defaultIteratorOptions,
      ...options,
    };
    const reverse = iteratorOptions.reverse;
    const startUserKey = new Slice(iteratorOptions.start);

    const lookupKey = new LookupKey(startUserKey, sequence);
    let lookupKeyUpdated = false;

    const iteratorList: AsyncIterableIterator<Entry>[] = [];

    this._memtable.ref();
    iteratorList.push(
      IteratorHelper.wrap(
        IteratorHelper.makeAsync(this._memtable.iterator(reverse)),
        () => {
          this._memtable.unref();
        },
      ),
    );
    if (this._immtable) {
      this._immtable.ref();
      iteratorList.push(
        IteratorHelper.wrap(
          IteratorHelper.makeAsync(this._immtable.iterator(reverse)),
          () => {
            this._immtable.unref();
          },
        ),
      );
    }

    const current = this._versionSet.current;
    const tableCache = this._versionSet.tableCache;
    current.ref();

    for (let i = 0; i < Config.kNumLevels; i++) {
      const files = current.files[i];

      if (files.length > 0) {
        for (const file of files) {
          // TODO change compare condition when reserve=true
          const shouldSkip = reverse
            ? this.userComparator.compare(startUserKey, file.smallest.userKey) <
              0
            : this.userComparator.compare(startUserKey, file.largest.userKey) >
              0;
          if (shouldSkip) continue;
          const status = await tableCache.findTable(file.number, file.fileSize);
          if (await status.ok()) {
            file.refs++;
            const tf = (await status.promise) as TableAndFile;
            iteratorList.push(
              IteratorHelper.wrap(tf.table.entryIterator(reverse), async () => {
                file.refs--;
                current.unref();
                await tf.file.close();
              }),
            );
          }
        }
      }
    }

    const merger = new IteratorMerger(
      this._internalKeyComparator,
      iteratorList,
      iteratorList.length,
    );

    for await (const entry of merger.iterator(reverse)) {
      const iKey = InternalKey.from(entry.key);
      const userKey = iKey.userKey;
      if (reverse) {
        if (
          !lookupKeyUpdated ||
          this.userComparator.compare(userKey, lookupKey.userKey) < 0
        ) {
          lookupKeyUpdated = true;
          lookupKey.userKey = userKey;
          if (iKey.type === ValueType.kTypeDeletion) continue;
          yield { key: userKey.buffer, value: entry.value.buffer };
        }
      } else {
        if (this.userComparator.compare(userKey, lookupKey.userKey) > 0) {
          lookupKey.userKey = userKey;
          if (iKey.type === ValueType.kTypeDeletion) continue;
          yield { key: userKey.buffer, value: entry.value.buffer };
        }
      }
    }
  }

  /**
   * db.get -> memtable.get -> imm.get -> versionCurrent.get ->
   * versionCurrent.forEachOverlapping -> tableCache.get -> tableCache.findTable ->
   * table.get
   */
  public async get(
    userKey: string | Uint8Array,
    options: ReadOptions = {},
  ): Promise<Uint8Array | void> {
    if (!this._ok) await this.ok();
    const slicedUserKey = new Slice(userKey);
    const sequence = options.snapshot
      ? new Snapshot(options.snapshot).sequenceNumber
      : new SequenceNumber(this._versionSet.lastSequence);
    const lookupKey = new LookupKey(slicedUserKey, sequence);

    const current = this._versionSet.current;
    this._memtable.ref();
    if (!!this._immtable) this._immtable.ref();
    current.ref();

    let hasStatUpdate = false;
    const stats = {} as GetStats;
    let result: Uint8Array | void = undefined;
    while (true) {
      const memResult = this._memtable.get(lookupKey);
      if (!!memResult) {
        if (memResult.type === ValueType.kTypeValue) {
          result = memResult.value.buffer;
        } else {
          break;
        }
      }
      if (!result && !!this._immtable) {
        const immResult = this._immtable.get(lookupKey);
        if (!!immResult) {
          if (immResult.type === ValueType.kTypeValue) {
            result = immResult.value.buffer;
          } else {
            break;
          }
        }
      }
      if (!result) {
        const s = await current.get(lookupKey, stats);
        hasStatUpdate = true;
        if (await s.ok()) {
          result = (await s.promise) as Buffer;
        }
      }
      break;
    }

    if (hasStatUpdate && current.updateStats(stats)) {
      await this.maybeScheduleCompaction();
    }

    this._memtable.unref();
    if (!!this._immtable) this._immtable.unref();
    current.unref();
    return result;
  }

  /**
   * TODO Trigger minor compaction's condition
   * 1. check if memtable bigger then 4mb
   * 2. check if this._immtable is not null（transfer memtable to sstable）
   */
  public put(
    key: string | Uint8Array,
    value: string | Uint8Array,
    options?: WriteOptions,
  ): Promise<void> {
    const batch = new WriteBatch();
    batch.put(key, value);
    const writeOptions = { ...defaultWriteOptions, ...options };
    return this.write(writeOptions, batch);
  }

  public del(key: string | Uint8Array, options?: WriteOptions): Promise<void> {
    const batch = new WriteBatch();
    batch.del(key);
    const writeOptions = { ...defaultWriteOptions, ...options };
    return this.write(writeOptions, batch);
  }

  public batch(batch: WriteBatch, options?: WriteOptions): Promise<void> {
    const writeOptions = { ...defaultWriteOptions, ...options };
    return this.write(writeOptions, batch);
  }

  public getSnapshot(): Snapshot {
    return this._snapshots.insert(
      new SequenceNumber(this._versionSet.lastSequence),
    );
  }

  public releaseSnapshot(snapshot: Snapshot): void {
    this._snapshots.delete(snapshot);
  }

  private async write(
    options: Required<WriteOptions>,
    batch?: WriteBatch,
  ): Promise<void> {
    if (!this._ok) await this.ok();
    const writer = new Writer();
    writer.batch = batch;
    this.writers.push(writer);
    while (this.writers.front() !== writer && !writer.done) {
      await writer.wait();
    }

    if (writer.done) {
      return;
    }

    const status = await this.makeRoomForWrite(!writer.batch);

    let lastWriter = writer;
    if ((await status.ok()) && !!writer.batch) {
      let lastSequence = this._versionSet.lastSequence;
      const [lastWriter_, batch] = this.buildBatchGroup();
      lastWriter = lastWriter_;
      WriteBatchInternal.setSequence(batch, lastSequence + 1);
      lastSequence += WriteBatchInternal.getCount(batch);

      await this._log.addRecord(
        new Slice(WriteBatchInternal.getContents(batch)),
      );

      WriteBatchInternal.insert(batch, this._memtable);

      if (batch === this.tmpBatch) this.tmpBatch.clear();
      this._versionSet.lastSequence = lastSequence;
    }

    while (true) {
      const front = this.writers.front();
      this.writers.popFront();
      if (front && front !== writer) {
        front.done = true;
        front.signal();
      }
      if (front === lastWriter) break;
    }

    if (this.writers.length > 0) {
      const front = this.writers.front();
      if (front) front.signal();
    }
  }

  private buildBatchGroup(): [Writer, WriteBatch] {
    const first = this.writers.front();
    if (!first) throw new Error(`writer is empty`);
    let result = first.batch;
    if (!result) throw new Error(`first batch is empty`);
    let size = WriteBatchInternal.byteSize(result);
    let maxSize = 1 << 20;
    const limit = 128 << 10;
    if (size <= limit) {
      maxSize = size + limit;
    }

    let lastWriter = first;

    // "1": Advance past "first"
    for (const writer of this.writers.iterator(1)) {
      if (writer.sync && !first.sync) {
        // Do not include a sync write into a batch handled by a non-sync write.
        break;
      }
      if (!!writer.batch) {
        size += WriteBatchInternal.byteSize(writer.batch);
        if (size > maxSize) {
          // Do not make batch too big
          break;
        }

        if (result === first.batch) {
          result = this.tmpBatch;
          assert(WriteBatchInternal.getCount(result) === 0);
          WriteBatchInternal.append(result, first.batch);
        }
        WriteBatchInternal.append(result, writer.batch);
      }
      lastWriter = writer;
    }
    return [lastWriter, result];
  }

  /**
   * if force is true, force compact
   */
  private async makeRoomForWrite(force: boolean): Promise<Status> {
    let allowDelay = !force;
    let status = new Status();
    while (true) {
      if (this._bgError) {
        status = this._bgError;
        break;
      } else if (
        allowDelay &&
        this._versionSet.getNumLevelFiles(0) >= Config.kL0SlowdownWritesTrigger
      ) {
        // We are getting close to hitting a hard limit on the number of
        // L0 files.  Rather than delaying a single write by several
        // seconds when we hit the hard limit, start delaying each
        // individual write by 1ms to reduce latency variance.  Also,
        // this delay hands over some CPU to the compaction thread in
        // case it is sharing the same core as the writer.
        if (this._options.debug) {
          this._options.log(`DEBUG level0 files >= slowdown trigger, wait 1s.`);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
        allowDelay = false;
      } else if (
        !force &&
        this._memtable.size <= this._options.writeBufferSize
      ) {
        // There is room in current memtable
        break;
      } else if (!!this._immtable) {
        // We have filled up the current memtable, but the previous
        // one is still being compacted, so we wait.
        this._options.log("Current memtable full; waiting...");
      } else if (
        this._versionSet.getNumLevelFiles(0) >= Config.kL0StopWritesTrigger
      ) {
        // There are too many level-0 files.
        // TODO wait
        this._options.log("Too many L0 files; waiting...");
      } else {
        // 1. level0number < 12 and no immtable
        // 2. if (not force) level0number < 8 and memtable > 4MB
        // 3. if (force)

        // Attempt to switch to a new memtable and trigger compaction of old
        this._options.log(
          "Attempt to switch to a new memtable and trigger compaction of old",
        );
        assert(this._versionSet.prevLogNumber === 0); // no logFile is compaction

        const newLogNumber = this._versionSet.getNextFileNumber();
        if (!!this._log) {
          await this._log.close();
          delete this._log;
        }
        this._log = new LogWriter(
          await this._options.env.open(
            getLogFilename(this._dbpath, newLogNumber),
            "a",
          ),
        );
        this._immtable = this._memtable;
        this._memtable = new MemTable(this._internalKeyComparator);
        this._memtable.ref();
        this._logFileNumber = newLogNumber;
        force = false;
        await this.maybeScheduleCompaction();
      }
    }
    return status;
  }

  private async maybeScheduleCompaction(): Promise<void> {
    if (this._options.debug)
      this._options.log(
        `DEBUG !this._immtable=${!this
          ._immtable} !this._manualCompaction=${!this
          ._manualCompaction} !this._versionSet.needsCompaction()=${!this._versionSet.needsCompaction()}`,
      );

    if (this._backgroundCompactionScheduled) {
      // Already scheduled
      this._options.log("Already scheduled");
    } else if (this._bgError && !(await this._bgError.ok())) {
      // Already got an error; no more changes
      this._options.log("Already got an error; no more changes");
    } else if (
      !this._immtable &&
      !this._manualCompaction &&
      !this._versionSet.needsCompaction()
    ) {
      // No work to be done
      this._options.log("No work to be done");
    } else {
      this._backgroundCompactionScheduled = true;
      // ignore: Env.Schedule, BGWork
      this._options.log("Background Compaction Scheduled");

      await this.backgroundCall();
    }
  }

  private async backgroundCall(): Promise<void> {
    assert(this._backgroundCompactionScheduled);
    await this.backgroundCompaction();
    this._backgroundCompactionScheduled = false;

    // Previous compaction may have produced too many files in a level,
    // so reschedule another compaction if needed.
    await this.maybeScheduleCompaction();
  }

  private async backgroundCompaction(): Promise<void> {
    if (!!this._immtable) {
      this._options.log(`backgroundCompaction Compact MemTable and return`);
      await this.compactMemTable();
      return;
    }

    let compaction: Compaction | void;
    let manualEnd = new InternalKey();

    if (!!this._manualCompaction) {
      const manual = this._manualCompaction;
      compaction = this._versionSet.compactRange(
        manual.level,
        manual.begin,
        manual.end,
      );
      manual.done = !compaction;
      if (!!compaction) {
        manualEnd =
          compaction.inputs[0][compaction.numInputFiles(0) - 1].largest;
      }
      // Manual compaction ...
      if (this._options.debug) this._options.log("DEBUG Manual compaction ...");
    } else {
      // is not manual compaction
      compaction = this._versionSet.pickCompaction();
    }

    let status = new Status();

    if (!compaction) {
      this._options.log(`backgroundCompaction no compaction`);
    } else if (!this._manualCompaction && compaction.isTrivialMove()) {
      this._options.log(`backgroundCompaction isTrivialMove`);

      assert(compaction.numInputFiles(0) === 1);
      const f = compaction.inputs[0][0];
      compaction.edit.deleteFile(compaction.level, f.number);
      compaction.edit.addFile(
        compaction.level + 1,
        f.number,
        f.fileSize,
        f.smallest,
        f.largest,
      );
      status = await this._versionSet.logAndApply(compaction.edit);
    } else {
      this._options.log(`backgroundCompaction doCompactionWork`);

      const compact = new CompactionState(compaction);
      const status = await this.doCompactionWork(compact);
      if (!(await status.ok())) {
        await this.recordBackgroundError(status);
      }
      await this.cleanupCompaction(compact);
      compaction.releaseInputs();
      await this.deleteObsoleteFiles();
    }

    if (await status.ok()) {
      this._options.log(`Compaction success...`);
    } else {
      this._options.log(`Compaction error...`);
    }

    if (!!this._manualCompaction) {
      const m = this._manualCompaction;
      if (!(await status.ok())) {
        m.done = true;
      }

      if (!m.done) {
        // We only compacted part of the requested range.  Update *m
        // to the range that is left to be compacted.
        m.tmpStorage = manualEnd;
        m.begin = m.tmpStorage;
      }
      delete this._manualCompaction;
    }
  }

  // major compaction
  private async doCompactionWork(compact: CompactionState): Promise<Status> {
    const startTime: number = this._options.env.now();
    let immTime = 0; // Time spent doing imm_ compactions
    this._options.log("Compacting files...");
    assert(this._versionSet.getNumLevelFiles(compact.compaction.level) > 0);
    assert(!compact.builder);
    assert(!compact.outfile);
    if (this._snapshots.isEmpty()) {
      compact.smallestSnapshot = this._versionSet.lastSequence;
    } else {
      compact.smallestSnapshot = this._snapshots.oldest().sequenceNumber.value;
    }

    let status = new Status();
    const ikey = new ParsedInternalKey();
    const currentUserKey = new Slice();
    let hasCurrentUserKey = false;
    let lastSequenceForKey = InternalKey.kMaxSequenceNumber;
    if (this._options.debug)
      this._options.log(`DEBUG doCompactionWork before make input iterator`);
    for await (const input of this._versionSet.makeInputIterator(
      compact.compaction,
    )) {
      if (!!this._immtable) {
        const immStartTime = this._options.env.now();
        await this.compactMemTable();
        immTime += this._options.env.now() - immStartTime;
      }

      const key = input.key;

      const shouldStopBefore = compact.compaction.shouldStopBefore(key);
      if (shouldStopBefore && !!compact.builder) {
        status = await this.finishCompactionOutputFile(compact, status);
        if (!(await status.ok())) {
          this._options.log(
            `Break because finishCompactionOutputFile fail ${
              status.message() || "-"
            }`,
          );
          break;
        }
      }
      let drop = false;
      if (!parseInternalKey(key, ikey)) {
        currentUserKey.clear();
        hasCurrentUserKey = false;
        lastSequenceForKey = InternalKey.kMaxSequenceNumber;
      } else {
        if (
          !hasCurrentUserKey ||
          this.userComparator.compare(ikey.userKey, currentUserKey) !== 0
        ) {
          // First occurrence of this user key
          currentUserKey.buffer = ikey.userKey.buffer;
          hasCurrentUserKey = true;
          lastSequenceForKey = InternalKey.kMaxSequenceNumber;
        }
        if (lastSequenceForKey.value <= compact.smallestSnapshot) {
          // Hidden by an newer entry for same user key
          drop = true; // (A)
        } else if (
          ikey.valueType === ValueType.kTypeDeletion &&
          ikey.sn.value <= compact.smallestSnapshot &&
          compact.compaction.isBaseLevelForKey(ikey.userKey)
        ) {
          // For this user key:
          // (1) there is no data in higher levels
          // (2) data in lower levels will have larger sequence numbers
          // (3) data in layers that are being compacted here and have
          //     smaller sequence numbers will be dropped in the next
          //     few iterations of this loop (by rule (A) above).
          // Therefore this deletion marker is obsolete and can be dropped.
          drop = true;
        }
        lastSequenceForKey = ikey.sn;
      }

      // used for debug
      // if (
      //   this._options.debug &&
      //   ikey.valueType === ValueType.kTypeDeletion &&
      //   !drop
      // ) {
      //   const snValueBig =
      //     ikey.sn.value > compact.smallestSnapshot
      //       ? 'key sequence is bigger then compact.smallestSnapshot. '
      //       : ''
      //   const isNotBaseLevel = !compact.compaction.isBaseLevelForKey(
      //     ikey.userKey
      //   )
      //     ? 'this level is not base level for key. '
      //     : ''
      //   const becauseMsg = !drop ? `Because ${snValueBig}${isNotBaseLevel}` : ''
      //   this._options.log(
      //     `${ikey.userKey} has been delete = ${drop}; ${becauseMsg}`
      //   )
      // }

      if (!drop) {
        // Open output file if necessary
        if (!compact.builder) {
          status = await this.openCompactionOutputFile(compact);
          if (!(await status.ok())) {
            this._options.log(
              `Break because openCompactionOutputFile fail ${
                status.message() || "-"
              }`,
            );
            break;
          }
        }
        if (compact.builder.numEntries == 0) {
          compact.currentOutput().smallest.decodeFrom(key);
        }
        compact.currentOutput().largest.decodeFrom(key);
        await compact.builder.add(key, input.value);

        // Close output file if it is big enough
        if (compact.builder.fileSize >= compact.compaction.maxOutputFilesize) {
          status = await this.finishCompactionOutputFile(compact, new Status());
          if (!(await status.ok())) {
            this._options.log(
              `Break because finishCompactionOutputFile2 fail ${
                status.message() || "-"
              }`,
            );
            break;
          }
        }
      }
    }

    if ((await status.ok()) && !!compact.builder) {
      status = await this.finishCompactionOutputFile(compact, status);
    }

    const stats = new CompactionStats();
    stats.times = this._options.env.now() - startTime - immTime;

    for (let which = 0 as 0 | 1; which < 2; which++) {
      for (let i = 0; i < compact.compaction.numInputFiles(which); i++) {
        stats.bytesRead += compact.compaction.inputs[which][i].fileSize;
      }
    }
    for (let i = 0; i < compact.outputs.length; i++) {
      stats.bytesWritten += compact.outputs[i].fileSize;
    }
    this._stats[compact.compaction.level + 1].add(stats);

    if (await status.ok()) {
      status = await this.installCompactionResults(compact);
    }

    // TODO log level summary
    this._options.log(`compacted to: ${this._versionSet.getLevelSummary()}`);

    return status;
  }

  private async compactMemTable(): Promise<void> {
    assert(!!this._immtable);

    // Save the contents of the memtable as a new Table
    const edit = new VersionEdit();
    const base = this._versionSet.current;
    base.ref();
    let s: Status = await this.writeLevel0Table(this._immtable, edit, base);
    base.unref();

    // Replace immutable memtable with the generated Table
    if (await s.ok()) {
      edit.prevLogNumber = 0;
      edit.logNumber = this._logFileNumber; // Earlier logs no longer needed
      s = await this._versionSet.logAndApply(edit);
    }

    if (await s.ok()) {
      // Commit to the new state
      assert(!!this._immtable);
      this._immtable.unref();
      delete this._immtable;
      await this.deleteObsoleteFiles();
    } else {
      this.recordBackgroundError(s);
    }
  }

  private async writeLevel0Table(
    mem: MemTable,
    edit: VersionEdit,
    base?: Version,
  ): Promise<Status> {
    if (mem.size === 0) return new Status(Promise.resolve());
    const startTime = this._options.env.now();
    const meta = new FileMetaData();
    meta.fileSize = 0;
    meta.number = this._versionSet.getNextFileNumber();
    meta.largest = new InternalKey();
    this.pendingOutputs.add(meta.number);
    this._options.log(`Level-0 table #${meta.number}: started`);
    const tableFilename = getTableFilename(this._dbpath, meta.number);
    let status = new Status(this._options.env.open(tableFilename, "a+"));
    if (!(await status.ok())) {
      return status;
    }
    const builder = new SSTableBuilder(
      this._options,
      (await status.promise) as FileHandle,
    );
    for (const entry of mem.iterator()) {
      if (!meta.smallest) {
        meta.smallest = InternalKey.from(entry.key);
      }
      meta.largest.decodeFrom(entry.key);
      await builder.add(entry.key, entry.value);
    }

    status = new Status(builder.finish());
    if (!(await status.ok())) {
      return status;
    }
    meta.fileSize = builder.fileSize;
    assert(meta.fileSize > 0);
    this._options.log(
      `Level-0 table #${meta.number}: ${meta.fileSize} bytes ${
        (await status.ok()) ? "status ok" : "status error"
      }`,
    );
    this.pendingOutputs.delete(meta.number);

    // Note that if file_size is zero, the file has been deleted and
    // should not be added to the manifest.
    let level = 0;
    if ((await status.ok()) && meta.fileSize > 0) {
      const minUserKey = meta.smallest.userKey;
      const maxUserKey = meta.largest.userKey;
      if (!!base) {
        level = base.pickLevelForMemTableOutput(minUserKey, maxUserKey);
        this._options.log(`Pick level=${level} for imm output`);
      }
      edit.addFile(
        level,
        meta.number,
        meta.fileSize,
        meta.smallest,
        meta.largest,
      );
    }

    const stats = new CompactionStats();
    stats.times = this._options.env.now() - startTime;
    stats.bytesWritten = meta.fileSize;
    this._stats[level].add(stats);
    return status;
  }

  private async openCompactionOutputFile(
    compact: CompactionState,
  ): Promise<Status> {
    assert(!!compact);
    assert(!compact.builder);
    const fileNumber = this._versionSet.getNextFileNumber();
    this.pendingOutputs.add(fileNumber);
    const out = {} as CompactionStateOutput;
    out.number = fileNumber;
    out.smallest = new InternalKey();
    out.largest = new InternalKey();
    compact.outputs.push(out);
    const tableFilename = getTableFilename(this._dbpath, fileNumber);
    this._options.log(`Compaction output file number is ${fileNumber}`);
    const status = new Status(this._options.env.open(tableFilename, "a+"));
    if (await status.ok()) {
      compact.outfile = (await status.promise) as FileHandle;
      compact.builder = new SSTableBuilder(this._options, compact.outfile);
      if (this._options.debug) this._options.log("DEBUG open file success");
    } else {
      if (this._options.debug)
        this._options.log(`DEBUG open file error ${status.message || ""}`);
    }
    return status;
  }

  private async installCompactionResults(
    compact: CompactionState,
  ): Promise<Status> {
    this._options.log(
      `Compacted ${compact.compaction.numInputFiles(0)}@${
        compact.compaction.level
      } + ${compact.compaction.numInputFiles(1)}@${
        compact.compaction.level + 1
      } files => ${compact.totalBytes} bytes"`,
    );
    // Add compaction outputs
    compact.compaction.addInputDeletions(compact.compaction.edit);
    const level = compact.compaction.level;
    if (this._options.debug)
      this._options.log(
        `DEBUG compact.outputs.length=${compact.outputs.length}`,
      );
    for (let i = 0; i < compact.outputs.length; i++) {
      const out = compact.outputs[i];
      compact.compaction.edit.addFile(
        level + 1,
        out.number,
        out.fileSize,
        out.smallest,
        out.largest,
      );
    }

    if (this._options.debug)
      this._options.log(
        `DEBUG installCompactionResults logAndApply starting...`,
      );

    const status = await this._versionSet.logAndApply(compact.compaction.edit);
    if (!(await status.ok())) {
      if (this._options.debug)
        this._options.log(`DEBUG installCompactionResults fail`);
    } else {
      if (this._options.debug)
        this._options.log(`DEBUG installCompactionResults success`);
    }
    return status;
  }

  /**
   * manually compact
   */
  public async compactRange(
    begin: Uint8Array | string,
    end: Uint8Array | string,
  ): Promise<void> {
    if (!this._ok) await this.ok();
    const sliceBegin = new Slice(begin);
    const sliceEnd = new Slice(end);
    let maxLevelWithFiles = 1;
    const base = this._versionSet._current;
    for (let level = 0; level < Config.kNumLevels; level++) {
      if (base.overlapInLevel(level, sliceBegin, sliceEnd)) {
        maxLevelWithFiles = level;
      }
    }

    await this.manualCompactMemTable();
    for (let level = 0; level < maxLevelWithFiles; level++) {
      await this.manualCompactRangeWithLevel(level, sliceBegin, sliceEnd);
    }
  }

  private async manualCompactRangeWithLevel(
    level: number,
    begin: Slice,
    end: Slice,
  ): Promise<void> {
    if (this._options.debug)
      this._options.log(`DEBUG manualCompactRangeWithLevel ${level}...`);
    assert(level >= 0);
    assert(level + 1 < Config.kNumLevels);
    let beginStorage = new InternalKey();
    let endStorage = new InternalKey();
    const manual = {} as ManualCompaction;

    manual.level = level;
    manual.done = false;
    if (!begin) {
      delete manual.begin;
    } else {
      beginStorage = new InternalKey(
        begin,
        InternalKey.kMaxSequenceNumber,
        kValueTypeForSeek,
      );
      manual.begin = beginStorage;
    }
    if (!end) {
      delete manual.end;
    } else {
      endStorage = new InternalKey(
        end,
        new SequenceNumber(0),
        ValueType.kTypeValue,
      );
      manual.end = endStorage;
    }

    while (!manual.done) {
      if (!this._manualCompaction) {
        // Idle
        this._manualCompaction = manual;
        await this.maybeScheduleCompaction();
      } else {
        if (this._options.debug)
          this._options.log(
            "DEBUG Running either my compaction or another compaction.",
          );
        // Running either my compaction or another compaction.
      }
    }
    if (this._manualCompaction === manual) {
      // Cancel my manual compaction since we aborted early for some reason.
      delete this._manualCompaction;
    }
  }

  private async manualCompactMemTable(): Promise<void> {
    await this.write(defaultWriteOptions);
  }

  private async recordBackgroundError(status: Status): Promise<void> {
    this._options.log(status.message() || "recordBackgroundError");
    this._bgError = status;
  }

  private async cleanupCompaction(compact: CompactionState): Promise<void> {
    if (!!compact.builder) {
      await compact.builder.abandon();
      delete compact.builder;
    } else {
      assert(!compact.outfile);
    }
    delete compact.outfile;
    for (let i = 0; i < compact.outputs.length; i++) {
      const out = compact.outputs[i];
      this.pendingOutputs.delete(out.number);
    }
  }

  private async deleteObsoleteFiles(): Promise<void> {
    const live = this.pendingOutputs;
    this._versionSet.addLiveFiles(live);
    const filenames = (await this._options.env.readdir(this._dbpath)).reduce(
      (filenames: string[], dirent: Dirent) => {
        if (dirent.isFile()) {
          filenames.push(dirent.name);
        }
        return filenames;
      },
      [],
    );
    const filesToDelete: string[] = [];
    for (const filename of filenames) {
      const internalFile = parseFilename(filename);
      const number = internalFile.number;
      const type = internalFile.type;

      if (internalFile.isInternalFile) {
        let keep = true;
        switch (type) {
          case FileType.kLogFile:
            keep =
              number >= this._versionSet.logNumber ||
              number === this._versionSet.prevLogNumber;
            break;
          case FileType.kDescriptorFile:
            // Keep my manifest file, and any newer incarnations'
            // (in case there is a race that allows other incarnations)
            keep = number >= this._versionSet.manifestFileNumber;
            break;
          case FileType.kTableFile:
            keep = live.has(number);
            break;
          case FileType.kTempFile:
            // Any temp files that are currently being written to must
            // be recorded in pending_outputs_, which is inserted into "live"
            keep = live.has(number);
            break;
          case FileType.kCurrentFile:
          case FileType.kDBLockFile:
          case FileType.kInfoLogFile:
            keep = true;
            break;
        }
        if (!keep) {
          filesToDelete.push(filename);
          if (type == FileType.kTableFile) {
            // TODO this.tableCache.Evict(number)
          }
          this._options.log(`Delete type=${type} #${number}`);
        }
      }
    }

    for (const filename of filesToDelete) {
      await this._options.env.unlink(path.resolve(this._dbpath, filename));
    }
  }

  private async finishCompactionOutputFile(
    compact: CompactionState,
    inputStatus: Status,
  ): Promise<Status> {
    let status = new Status();
    assert(!!compact);
    assert(!!compact.outfile);
    assert(!!compact.builder);
    const outputNumber = compact.currentOutput().number;
    assert(outputNumber !== 0);
    const currentEntries = compact.builder.numEntries;
    if (await inputStatus.ok()) {
      status = new Status(compact.builder.finish());
      await status.ok();
    } else {
      await compact.builder.abandon();
    }

    const currentBytes = compact.builder.fileSize;
    compact.currentOutput().fileSize = currentBytes;
    compact.totalBytes += currentBytes;

    delete compact.builder;
    delete compact.outfile;

    if (currentEntries > 0) {
      status = new Status(
        this._options.env.access(getTableFilename(this._dbpath, outputNumber)),
      );
      if (await status.ok()) {
        this._options.log(
          `Generated table #${outputNumber}@${compact.compaction.level}: ${currentEntries} keys, ${currentBytes} bytes`,
        );
      }
    }

    return status;
  }
}
