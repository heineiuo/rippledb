/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert'

enum Code {
  kOk = 0,
  kNotFound = 1,
  kCorruption = 2,
  kNotSupported = 3,
  kInvalidArgument = 4,
  kIOError = 5,
}

class StatusError extends Error {
  _code: Code
  constructor(code: Code, message?: string) {
    super(message)
    this._code = code
  }
}

export default class Status {
  static createNotFound(message?: string) {
    return new Status(Promise.reject(new StatusError(Code.kNotFound, message)))
  }
  static createCorruption(message?: string) {
    return new Status(
      Promise.reject(new StatusError(Code.kCorruption, message))
    )
  }

  private _error!: Error
  private _promise: Promise<any> | void
  private _code!: Code
  private _finish: boolean

  constructor(promise?: Promise<any>) {
    this._promise = promise
    this._finish = false
  }

  get promise() {
    return this._promise
  }

  get error() {
    return this._error
  }

  private async wait(): Promise<void> {
    if (this._finish) return
    try {
      await this._promise
    } catch (e) {
      if (e.code) this._code = e.code
      this._error = e
    } finally {
      this._finish = true
    }
  }

  public async ok(): Promise<boolean> {
    await this.wait()
    return !this._error
  }

  public message(): string | void {
    assert(this._finish)
    if (this._error) {
      return this._error.message
    }
  }

  public isNotFound() {
    assert(this._finish)
    return this._code === Code.kNotFound
  }

  public isCorruption() {
    assert(this._finish)
    return this._code === Code.kCorruption
  }

  public isIOError() {
    assert(this._finish)
    return this._code === Code.kIOError
  }

  public isNotSupportedError() {
    assert(this._finish)
    return this._code === Code.kNotSupported
  }

  public isInvalidArgument() {
    assert(this._finish)
    return this._code === Code.kNotSupported
  }
}
