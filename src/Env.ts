/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from 'fs'

export interface FileHandle extends fs.promises.FileHandle {}
export interface Direct extends fs.Dirent {}

export interface Env {
  // get current time
  now(): number
  access(dbpath: string): Promise<void>
  mkdir(dbpath: string): Promise<void>
  readFile(dbpath: string): Promise<Buffer>
  readFile(
    dbpath: string,
    options: { encoding: string }
  ): Promise<string | Buffer>
  readFile(dbpath: string, bufferEncoding: 'utf8'): Promise<string>
  writeFile(dbpath: string, content: Buffer | string): Promise<void>
  open(dbpath: string, flag: string): Promise<FileHandle>
  unlink(dbpath: string): Promise<void>
  readdir(dbpath: string): Promise<Direct[]>
}

export class NodeEnv implements Env {
  /**
   * get current time
   */
  now(): number {
    return Number(process.hrtime.bigint()) / Math.pow(10, 9)
  }

  access(dbpath: string) {
    return fs.promises.access(dbpath, fs.constants.W_OK)
  }

  mkdir(dbpath: string) {
    return fs.promises.mkdir(dbpath, { recursive: true })
  }

  writeFile = fs.promises.writeFile
  readFile = fs.promises.readFile
  open = fs.promises.open
  unlink = fs.promises.unlink

  readdir(dbpath: string) {
    return fs.promises.readdir(dbpath, { withFileTypes: true })
  }
}
