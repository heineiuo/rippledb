/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from 'path'
import { FileType } from './Format'

function numberToString(num: number) {
  let str = String(num)
  while (str.length < 6) {
    str = `0${str}`
  }
  return str
}

export function getCurrentFilename(dbpath: string) {
  return path.resolve(dbpath, 'CURRENT')
}

export function getLogFilename(dbpath: string, logNumber: number): string {
  return path.resolve(dbpath, `${numberToString(logNumber)}.log`)
}

export function getTableFilename(dbpath: string, tableNumber: number): string {
  return path.resolve(dbpath, `${numberToString(tableNumber)}.ldb`)
}

export function getManifestFilename(
  dbpath: string,
  manifestNumber: number
): string {
  return path.resolve(dbpath, `MANIFEST-${numberToString(manifestNumber)}`)
}

export function getLockFilename(
  dbpath: string,
  manifestNumber: number
): string {
  return path.resolve(dbpath, `LOCK`)
}

export function getInfoLogFilename(dbpath: string): string {
  return path.resolve(dbpath, `LOG`)
}

export function getOldInfoLogFilename(dbpath: string): string {
  return path.resolve(dbpath, `LOG.old`)
}

export function parseFilename(
  filename: string,
  number: number,
  type: FileType
): boolean {
  if (filename === 'CURRENT') {
    number = 0
    type = FileType.kCurrentFile
  } else if (filename === 'LOCK') {
    number = 0
    type = FileType.kLogFile
  } else if (filename === 'LOG' || filename === 'LOG.old') {
    number = 0
    type = FileType.kInfoLogFile
  } else if (filename.startsWith('MANIFEST-')) {
    let num = Number(filename.substr('MANIFEST-'.length))
    if (isNaN(num)) {
      return false
    }
    number = num
    type = FileType.kDescriptorFile
  } else {
    let num = Number(filename.split('.')[0])
    if (isNaN(num)) return false
    let suffix = filename.substr(filename.split('.')[0].length)
    if (suffix === '.log') {
      type = FileType.kLogFile
    } else if (suffix === '.ldb') {
      type = FileType.kTableFile
    } else if (suffix === '.dbtmp') {
      type = FileType.kTempFile
    } else {
      return false
    }
    number = num
  }

  return true
}
