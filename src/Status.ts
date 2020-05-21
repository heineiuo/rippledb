/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { assert } from "./DBHelper";

enum Code {
  kOk = 0,
  kNotFound = 1,
  kCorruption = 2,
  kNotSupported = 3,
  kInvalidArgument = 4,
  kIOError = 5,
}

export class StatusError extends Error {
  _code: Code;
  constructor(code: Code, message?: string) {
    super(message);
    this._code = code;
  }
}

export default class Status {
  static createNotFound(message?: string): Status {
    return new Status(Promise.reject(new StatusError(Code.kNotFound, message)));
  }
  static createCorruption(message?: string): Status {
    return new Status(
      Promise.reject(new StatusError(Code.kCorruption, message)),
    );
  }

  private _error!: Error;
  private _promise: Promise<unknown> | void;
  private _code!: Code;
  private _finish: boolean;

  constructor(promise?: Promise<unknown>) {
    this._promise = promise;
    this._finish = false;
  }

  get promise(): void | Promise<unknown> {
    return this._promise;
  }

  get error(): Error {
    return this._error;
  }

  private async wait(): Promise<void> {
    if (this._finish) return;
    try {
      await this._promise;
    } catch (e) {
      if (e._code) this._code = e._code;
      this._error = e;
    } finally {
      this._finish = true;
    }
  }

  public async ok(): Promise<boolean> {
    await this.wait();
    return !this._error;
  }

  public message(): string | void {
    assert(this._finish);
    if (this._error) {
      return this._error.message;
    }
  }

  public isNotFound(): boolean {
    assert(this._finish);
    return this._code === Code.kNotFound;
  }

  public isCorruption(): boolean {
    assert(this._finish);
    return this._code === Code.kCorruption;
  }

  public isIOError(): boolean {
    assert(this._finish);
    return this._code === Code.kIOError;
  }

  public isNotSupportedError(): boolean {
    assert(this._finish);
    return this._code === Code.kNotSupported;
  }

  public isInvalidArgument(): boolean {
    assert(this._finish);
    return this._code === Code.kNotSupported;
  }
}
