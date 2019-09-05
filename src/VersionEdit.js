/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @flow

import Slice from './Slice'

export default class VersionEdit {
  constructor () {
    this.deletedFiles = []
    this.newFiles = []
    this.compactPointers = []
  }

  clear () {
    this.deletedFiles = []
    this.newFiles = []
    this.compactPointers = []

    this._logNumber = 0
    this._prevLogNumber = 0
    this._lastSequence = 0
    this._nextFileNumber = 0
    this._comparator = null
    this._lastLogNumber = 0
    this._hasComparator = false
    this._hasLogNumber = false
    this._hasPrevLogNumber = false
    this._hasNextFileNumber = false
    this._hasLastSequence = false
  }

  set comparator (value:string) {
    this._comparator = value
    this._hasComparator = true
  }

  get comparator ():string | null {
    return this._comparator || null
  }

  set logNumber (value:number) {
    this._logNumber = value
    this._hasLogNumber = true
  }

  get logNumber ():number {
    return this._logNumber || 0
  }

  set prevLogNumber (value: number) {
    this._prevLogNumber = value
    this._hasPrevLogNumber = true
  }

  get prevLogNumber () :number {
    return this._prevLogNumber || 0
  }

  set nextFileNumber (value:number) {
    this._nextFileNumber = value
    this._hasNextFileNumber = true
  }

  get nextFileNumber () :number {
    return this._nextFileNumber || 0
  }

  set lastSequence (value: number) {
    this._lastSequence = value
    this._hasLastSequence = true
  }

  get lastSequence ():number {
    return this._lastSequence || 0
  }

  get hasComparator ():boolean {
    return this._hasComparator || false
  }

  get hasLogNumber ():boolean {
    return this._hasLogNumber || false
  }

  get hasPrevLogNumber ():boolean {
    return this._hasPrevLogNumber || false
  }

  get hasNextFileNumber () :boolean {
    return this._hasNextFileNumber || false
  }

  get hasLastSequence ():boolean {
    return this._hasLastSequence || false
  }

  compactPointers: { level:Number, internalKey:Slice}[]
  deletedFiles: {level: number, fileNum: number}[]
  newFiles: {level:number, fileNum:number, fileSize:number, smallestKey:Slice, largestKey:Slice}[]
  _comparator: string | null
  _logNumber:number
  _prevLogNumber: number
  _lastLogNumber: number
  _lastSequence: number
  _nextFileNumber: number
  _hasComparator: boolean
  _hasLogNumber: boolean
  _hasPrevLogNumber: boolean
  _hasNextFileNumber: boolean
  _hasLastSequence: boolean
}
