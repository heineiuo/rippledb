/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Options } from "./Options";
import { parseFilename } from "./Filename";
import { FileType } from "./Format";
import { Env } from "./Env";

export class InternalDBRepairer {
  constructor(dbpath: string, options: Options) {
    this._dbpath = dbpath;
    this._options = options;
    this._manifests = [];
    this._logs = [];
    this._tables = [];
    this._env = options.env;
    this._nextFileNumber = 1;
  }

  private _env: Env;
  private _manifests: string[];
  private _logs: number[];
  private _tables: number[];
  private _dbpath: string;
  private _options: Options;
  private _nextFileNumber: number;

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

  async run(): Promise<void> {
    await this.findFiles();
  }
}
