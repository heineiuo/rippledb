/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class Status {
  private _error!: Error
  private _promise: Promise<any> | void

  constructor(promise?: Promise<any>) {
    this._promise = promise
  }

  get promise() {
    return this._promise
  }

  get error() {
    return this._error
  }

  private async wait(): Promise<void> {
    try {
      await this._promise
    } catch (e) {
      this._error = e
    }
  }

  public async ok(): Promise<boolean> {
    await this.wait()
    return !this._error
  }

  public async message(): Promise<string | null> {
    await this.wait()
    if (this._error) {
      return this._error.message
    }
    return null
  }
}
