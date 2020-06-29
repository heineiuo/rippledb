/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Options,
  DatabaseOptions,
  defaultOptions,
  ReadOptions,
} from "./Options";
import {
  parseFilename,
  getLogFilename,
  getTableFilename,
  getTempFilename,
  getManifestFilename,
  setCurrentFile,
} from "./Filename";
import {
  FileType,
  InternalKeyComparator,
  SequenceNumber,
  parseInternalKey,
  ParsedInternalKey,
} from "./Format";
import { Env, FileHandle } from "./Env";
import LogReader from "./LogReader";
import MemTable from "./MemTable";
import { WriteBatch, WriteBatchInternal } from "./WriteBatch";
import { FileMetaData } from "./VersionFormat";
import { buildTable } from "./Builder";
import { TableCache } from "./SSTableCache";
import SSTableBuilder from "./SSTableBuilder";
import VersionEdit from "./VersionEdit";
import LogWriter from "./LogWriter";
import VersionEditRecord from "./VersionEditRecord";
import { path } from "./DBHelper";

type TableInfo = {
  meta: FileMetaData;
  maxSequence: SequenceNumber;
};

export class InternalDBRepairer {
  constructor(dbpath: string, originalOptions: DatabaseOptions) {
    if (!originalOptions.env) throw new Error("env required");
    const env = originalOptions.env;
    this._dbpath = dbpath;
    this._options = { ...defaultOptions, ...originalOptions, env };
    this._manifests = [];
    this._logs = [];
    this._icmp = new InternalKeyComparator(this._options.comparator);
    this._tables = [];
    this._env = this._options.env;
    this._nextFileNumber = 1;
    this._tableCache = new TableCache(dbpath, this._options, 10);
    this._tableInfos = [];
    this._edit = new VersionEdit();
  }

  private _env: Env;
  private _icmp: InternalKeyComparator;
  private _manifests: string[];
  private _logs: number[];
  private _tables: number[];
  private _tableInfos: TableInfo[];
  private _dbpath: string;
  private _options: Options;
  private _nextFileNumber: number;
  private _tableCache: TableCache;
  private _edit: VersionEdit;

  async run(): Promise<void | Error> {
    let error: void | Error;
    error = await this.findFiles();
    if (!error) {
      await this.convertLogFilesToTables();
      await this.extractMetaData();
      error = await this.writeDescriptor();
    }
    if (!error) {
      let bytes = 0;
      for (const tableInfo of this._tableInfos) {
        bytes += tableInfo.meta.fileSize;
      }
      this._options.log(
        `**** Repaired leveldb ${this._dbpath}; 
recovered ${this._tableInfos.length} files; ${bytes} bytes. 
Some data may have been lost. 
****`,
      );
    }
    return error;
  }

  async findFiles(): Promise<void | Error> {
    const filenames = (await this._options.env.readdir(this._dbpath)).reduce(
      (filenames: string[], dirent) => {
        if (dirent.isFile()) {
          filenames.push(dirent.name);
        }
        return filenames;
      },
      [],
    );
    if (filenames.length === 0) {
      throw new Error("DBRepairer found no files");
    }

    for (const filename of filenames) {
      const parsedFile = parseFilename(filename);
      if (parsedFile.type === FileType.kDescriptorFile) {
        this._manifests.push(filename);
      } else {
        if (parsedFile.number + 1 > this._nextFileNumber) {
          this._nextFileNumber = parsedFile.number + 1;
        }
        if (parsedFile.type === FileType.kLogFile) {
          this._logs.push(parsedFile.number);
        } else if (parsedFile.type === FileType.kTableFile) {
          this._tables.push(parsedFile.number);
        } else {
          // Ignore other files
        }
      }
    }
  }

  async convertLogFilesToTables(): Promise<void> {
    for (const logFileNumber of this._logs) {
      const logFilename = getLogFilename(this._dbpath, logFileNumber);
      try {
        await this.convertLogToTable(logFileNumber);
      } catch (e) {
        this._options.log(
          `Log #${logFileNumber}: Ignoring conversion error: ${e.message}`,
        );
      } finally {
        this.archiveFile(logFilename);
      }
    }
  }

  async convertLogToTable(logNumber: number): Promise<void> {
    const logFilename = getLogFilename(this._dbpath, logNumber);
    const reader = new LogReader(
      await this._options.env.open(logFilename, "r"),
    );
    const mem = new MemTable(this._icmp);
    mem.ref();

    for await (const record of reader.iterator()) {
      if (record.size < 12) {
        this._options.log(
          ` ${logFilename} log record too small: dropping ${record.size} bytes`,
        );
        continue;
      }

      try {
        const batch = new WriteBatch();
        WriteBatchInternal.setContents(batch, record.buffer);
        WriteBatchInternal.insert(batch, mem);
      } catch (e) {
        this._options.log(`Log #${logNumber}: Ignoring ${e.message}`);
      }
    }
    await reader.close();

    const meta = new FileMetaData();
    meta.number = this._nextFileNumber++;

    const status = await buildTable(
      this._dbpath,
      this._env,
      this._options,
      mem.iterator(),
      meta,
    );

    mem.unref();
    if (await status.ok()) {
      if (meta.fileSize > 0) {
        this._tables.push(meta.number);
      }
    }
    this._options.log(
      `Log #${logNumber}: ops saved to Table #${meta.number} ${status.message}`,
    );
  }

  async archiveFile(filename: string): Promise<void> {
    // Move into another directory.  E.g., for
    //    dir/foo
    // rename to
    //    dir/lost/foo
    const slashIndex = filename.lastIndexOf("/");
    const lostDir = filename.substr(0, slashIndex) + "/lost";
    try {
      await this._env.mkdir(lostDir);
    } catch (e) {}
    const newFilename = lostDir + filename.substr(slashIndex);
    await this._env.rename(filename, newFilename);
    this._options.log(`Archiving ${filename}: ${newFilename}`);
  }

  async extractMetaData(): Promise<void> {
    for (const tableNumber of this._tables) {
      await this.scanTable(tableNumber);
    }
  }

  async scanTable(tableNumber: number): Promise<void> {
    const tableInfo: TableInfo = {
      meta: new FileMetaData(),
      maxSequence: 0n,
    };
    tableInfo.meta.number = tableNumber;
    const tableFilename = getTableFilename(this._dbpath, tableNumber);
    try {
      tableInfo.meta.fileSize = await this._env.getFileSize(tableFilename);
    } catch (e) {
      try {
        await this.archiveFile(tableFilename);
      } catch (e) {}
    }

    // Extract metadata by scanning through table.
    let counter = 0;
    let empty = true;
    const options: ReadOptions = {};
    const parsed = new ParsedInternalKey();
    let error: Error | void;
    try {
      for await (const entry of this._tableCache.entryIterator(
        options,
        tableInfo.meta.number,
        tableInfo.meta.fileSize,
      )) {
        if (!parseInternalKey(entry.key, parsed)) {
          this._options.log(
            `Table #${
              tableInfo.meta.number
            }: unparseable key ${entry.key.toString()}`,
          );
          continue;
        }

        counter++;
        if (empty) {
          empty = false;
          tableInfo.meta.smallest.decodeFrom(entry.key);
        }
        tableInfo.meta.largest.decodeFrom(entry.key);
        if (parsed.sn > tableInfo.maxSequence) {
          tableInfo.maxSequence = parsed.sn;
        }
      }
      this._tableInfos.push(tableInfo);
    } catch (e) {
      error = e;
      this.repairTable(tableFilename, tableInfo); // RepairTable archives input file.
    } finally {
      this._options.log(
        `Table #${tableInfo.meta.number}: ${counter} entries ${
          error ? error.message : "success"
        }`,
      );
    }
  }

  async repairTable(
    srcTableFilename: string,
    tableInfo: TableInfo,
  ): Promise<void> {
    // We will copy src contents to a new table and then rename the
    // new table over the source.
    const destTableFilename = getTableFilename(
      this._dbpath,
      this._nextFileNumber++,
    );
    const fd = await this._env.open(destTableFilename, "a+");
    const tableBuilder = new SSTableBuilder(this._options, fd);
    const options: ReadOptions = {};
    let counter = 0;
    for await (const entry of this._tableCache.entryIterator(
      options,
      tableInfo.meta.number,
      tableInfo.meta.fileSize,
    )) {
      await tableBuilder.add(entry.key, entry.value);
      counter++;
    }

    let error: Error | void;
    try {
      await this.archiveFile(srcTableFilename);
      if (counter === 0) {
        await tableBuilder.abandon();
      } else {
        await tableBuilder.finish();
        tableInfo.meta.fileSize = tableBuilder.fileSize;
      }
    } catch (e) {
      error = e;
    } finally {
      try {
        if (counter > 0 && !error) {
          const orig = getTableFilename(this._dbpath, tableInfo.meta.number);
          await this._env.rename(destTableFilename, orig);
          this._options.log(
            `Table #${tableInfo.meta.number}: ${counter} entries repaired`,
          );
        }
      } catch (e) {
        error = e;
      } finally {
        if (error) {
          try {
            await this._env.unlink(destTableFilename);
          } catch (e) {}
        }
      }
    }
  }

  async writeDescriptor(): Promise<void | Error> {
    const tempFilename = getTempFilename(this._dbpath, 1);
    let error: void | Error;
    let file: FileHandle | void;
    try {
      file = await this._env.open(tempFilename, "a+");
    } catch (e) {
      error = e;
    }
    if (error || !file) return;
    let maxSequence = 0n;
    for (const tableInfo of this._tableInfos) {
      if (maxSequence < tableInfo.maxSequence) {
        maxSequence = tableInfo.maxSequence;
      }
    }

    this._edit.comparator = this._icmp.userComparator.getName();
    this._edit.logNumber = 0;
    this._edit.nextFileNumber = this._nextFileNumber;
    this._edit.lastSequence = maxSequence;
    for (const tableInfo of this._tableInfos) {
      this._edit.addFile(
        0,
        tableInfo.meta.number,
        tableInfo.meta.fileSize,
        tableInfo.meta.smallest,
        tableInfo.meta.largest,
      );
    }
    let writer: void | LogWriter;
    try {
      writer = new LogWriter(file);
      await writer.addRecord(VersionEditRecord.add(this._edit));
    } catch (e) {
      error = e;
    }
    if (!error && writer) {
      await writer.close();
    }
    if (error) {
      await this._env.unlink(tempFilename);
    } else {
      try {
        for (const manifest of this._manifests) {
          await this.archiveFile(path.resolve(this._dbpath, manifest));
        }
        // Install new manifest
        this._env.rename(tempFilename, getManifestFilename(this._dbpath, 1));
      } catch (e) {
        error = e;
      }
      if (error) {
        this._env.unlink(tempFilename);
      } else {
        await setCurrentFile(this._env, this._dbpath, 1);
      }
    }
    return error;
  }
}
