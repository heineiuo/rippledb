/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Options } from "./Options";

export class Repairer {
  static async repair(dbpath: string, options: Options): Promise<void> {
    const repairer = new Repairer(dbpath, options);
    await repairer.run();
  }

  constructor(dbpath: string, options: Options) {
    this.dbpath = dbpath;
    this.options = options;
  }

  private dbpath: string;
  private options: Options;

  async findFiles(): Promise<void> {
    return;
  }

  async run(): Promise<void> {
    return;
  }
}
