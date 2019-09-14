/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @flow

import path from 'path'

function numberToString (number) {
  let str = Number(number)
  while (str.length < 6) {
    str = `0${str}`
  }
  return str
}

export function getCurrentFilename (dbpath:string) {
  return path.resolve(dbpath, 'CURRENT')
}

export function getLogFilename (dbpath:string, logNumber:number) :string {
  return path.resolve(dbpath, `${numberToString(logNumber)}.log`)
}

export function getTableFilename (dbpath:string, tableNumber: number) :string {
  return path.resolve(dbpath, `${numberToString(tableNumber)}.ldb`)
}

export function getManifestFilename (dbpath:string, manifestNumber: number|string) :string {
  return path.resolve(dbpath, typeof manifestNumber === 'string' ? manifestNumber : `MANIFEST-${numberToString(manifestNumber)}`)
}

export function getLockFilename (dbpath:string, manifestNumber: number):string {
  return path.resolve(dbpath, `LOCK`)
}

export function getInfoLogFilename (dbpath:string):string {
  return path.resolve(dbpath, `LOG`)
}

export function getOldInfoLogFilename (dbpath:string):string {
  return path.resolve(dbpath, `LOG.old`)
}
