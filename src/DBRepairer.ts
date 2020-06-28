/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Options } from "./Options";
import { parseFilename, getLogFilename, getTableFilename } from "./Filename";
import { FileType, InternalKeyComparator, SequenceNumber } from "./Format";
import { Env } from "./Env";
import LogReader from "./LogReader";
import MemTable from "./MemTable";
import { WriteBatch, WriteBatchInternal } from "./WriteBatch";
import { FileMetaData } from "./VersionFormat";
import { buildTable } from "./Builder";

type TableInfo = {
  meta: FileMetaData;
  maxSequence: SequenceNumber;
};

export class InternalDBRepairer {
  constructor(dbpath: string, options: Options) {
    this._dbpath = dbpath;
    this._options = options;
    this._manifests = [];
    this._logs = [];
    this._icmp = new InternalKeyComparator(options.comparator);
    this._tables = [];
    this._env = options.env;
    this._nextFileNumber = 1;
  }

  private _env: Env;
  private _icmp: InternalKeyComparator;
  private _manifests: string[];
  private _logs: number[];
  private _tables: number[];
  private _dbpath: string;
  private _options: Options;
  private _nextFileNumber: number;

  async run(): Promise<void> {
    await this.findFiles();
    await this.convertLogFilesToTables();
    await this.extractMetaData();
  }

  async findFiles(): Promise<void> {
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
    const tableInfo = {} as TableInfo;
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
  }
}
