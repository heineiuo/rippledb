/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Options } from './Options'

export class Repair {
  static async repair(dbpath: string, options?: Options): Promise<void> {
    const repairer = new Repair(dbpath, options)
    await repairer.run()
  }

  constructor(dbpath: string, options?: Options) {
    this.dbpath = dbpath
    this.options = options || new Options()
  }

  private dbpath: string
  private options: Options

  run = async (): Promise<void> => {}
}
