/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from 'path'
import { FileType } from './Format'

function numberToString(num: number): string {
  let str = String(num)
  while (str.length < 6) {
    str = `0${str}`
  }
  return str
}

export function getCurrentFilename(dbpath: string): string {
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

export function getLockFilename(dbpath: string): string {
  return path.resolve(dbpath, `LOCK`)
}

export function getInfoLogFilename(dbpath: string): string {
  return path.resolve(dbpath, `LOG`)
}

export function getOldInfoLogFilename(dbpath: string): string {
  return path.resolve(dbpath, `LOG.old`)
}

export class InternalFile {
  isInternalFile = true
  filename!: string
  number!: number
  type!: FileType
}

export function parseFilename(filename: string): InternalFile {
  const internalFile = new InternalFile()
  if (filename === 'CURRENT') {
    internalFile.number = 0
    internalFile.type = FileType.kCurrentFile
  } else if (filename === 'LOCK') {
    internalFile.number = 0
    internalFile.type = FileType.kDBLockFile
  } else if (filename === 'LOG' || filename === 'LOG.old') {
    internalFile.number = 0
    internalFile.type = FileType.kInfoLogFile
  } else if (filename.startsWith('MANIFEST-')) {
    const num = Number(filename.substr('MANIFEST-'.length))
    if (isNaN(num)) {
      internalFile.isInternalFile = false
      return internalFile
    }
    internalFile.number = num
    internalFile.type = FileType.kDescriptorFile
  } else {
    const num = Number(filename.split('.')[0])
    if (isNaN(num)) {
      internalFile.isInternalFile = false
      return internalFile
    }
    const suffix = filename.substr(filename.split('.')[0].length)
    if (suffix === '.log') {
      internalFile.type = FileType.kLogFile
    } else if (suffix === '.ldb') {
      internalFile.type = FileType.kTableFile
    } else if (suffix === '.dbtmp') {
      internalFile.type = FileType.kTempFile
    } else {
      internalFile.isInternalFile = false
      return internalFile
    }
    internalFile.number = num
  }

  return internalFile
}
