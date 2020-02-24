/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from 'fs'
import { default as os } from 'os'

// eslint-disable-next-line
export interface FileHandle extends fs.promises.FileHandle {}
// eslint-disable-next-line
export interface Dirent extends fs.Dirent {}

export interface Env {
  platform(): string
  // get current time
  now(): number
  access(dbpath: string): Promise<void>
  mkdir(dbpath: string): Promise<void>
  rename(oldpath: string, newpath: string): Promise<void>
  readFile(dbpath: string): Promise<Buffer>
  readFile(
    dbpath: string,
    options: { encoding: string }
  ): Promise<string | Buffer>
  readFile(dbpath: string, bufferEncoding: 'utf8'): Promise<string>
  writeFile(dbpath: string, content: Buffer | string): Promise<void>
  open(dbpath: string, flag: string): Promise<FileHandle>
  unlink(filename: string): Promise<void>
  unlinkSync(filename: string): void
  fstat(fd: FileHandle): Promise<fs.Stats>
  readdir(dbpath: string): Promise<Dirent[]>
}

export class InfoLog {
  constructor(file: FileHandle) {
    this._file = file
  }

  private _file: FileHandle

  async log(message: string): Promise<void> {
    const finalMessage = `${new Date().toISOString()} ${message}\n`
    await this._file.appendFile(finalMessage)
  }
}

export function Log(infoLog: InfoLog, message: string): Promise<void> {
  if (infoLog) {
    return infoLog.log(message)
  }
  return Promise.resolve()
}

export class NodeEnv implements Env {
  platform(): string {
    return os.platform()
  }
  /**
   * get current time
   */
  now(): number {
    return Number(process.hrtime.bigint()) / Math.pow(10, 9)
  }

  access(dbpath: string): Promise<void> {
    return fs.promises.access(dbpath, fs.constants.W_OK)
  }

  mkdir(dbpath: string): Promise<void> {
    return fs.promises.mkdir(dbpath, { recursive: true })
  }

  writeFile = fs.promises.writeFile
  readFile = fs.promises.readFile
  open = fs.promises.open
  rename = fs.promises.rename
  unlink = fs.promises.unlink
  unlinkSync = fs.unlinkSync
  fstat = fs.promises.fstat

  // eslint-disable-next-line
  readdir(dbpath: string) {
    return fs.promises.readdir(dbpath, { withFileTypes: true })
  }
}
