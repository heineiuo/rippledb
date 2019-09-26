/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class Status {
  private error!: Error
  private promise: Promise<any> | void

  constructor(promise?: Promise<any>) {
    this.promise = promise
  }

  async wait(): Promise<void> {
    try {
      await this.promise
    } catch (e) {
      this.error = e
    }
  }

  async ok(): Promise<boolean> {
    await this.wait()
    return !this.error
  }

  async message(): Promise<string | null> {
    await this.wait()
    if (this.error) {
      return this.error.message
    }
    return null
  }
}
