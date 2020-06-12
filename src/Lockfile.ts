/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Options } from "./Options";

export class Lockfile {
  constructor(filename: string, options: Options) {
    this.filename = filename;
    this.options = options;

    this.stale = options.lockfileStale;

    this.options.env.onExit(() => {
      // if db has been destoryed manully, unlink will fail.
      try {
        this.options.env.unlinkSync(this.filename);
      } catch (e) {}
    });
  }

  private filename: string;
  private options: Options;
  // TODO compatible both nodejs and deno
  private refreshLockTimer!: any;
  private _locked = false;
  private stale: number;

  public get locked(): boolean {
    return this._locked;
  }

  public async unlock(): Promise<void> {
    try {
      // if db has been destoryed manully, unlink will fail.
      await this.options.env.unlink(this.filename);
    } catch (e) {}
    this._locked = false;
    clearInterval(this.refreshLockTimer);
  }

  private async waitUntilExpire(startTime = Date.now()): Promise<boolean> {
    try {
      try {
        const filetime = await this.options.env.getFileTime(this.filename);
        if (Date.now() > filetime + this.stale + 1000) return true;
      } catch (e) {}
      // wait time should be longer
      if (Date.now() > startTime + this.stale * 2 + 1000) return false;
      await new Promise((resolve) => setTimeout(resolve, this.stale / 2));
      return await this.waitUntilExpire(startTime);
    } catch (e) {
      return false;
    }
  }

  private async waitUntilOk(): Promise<boolean> {
    try {
      const file = await this.options.env.open(this.filename, "r");
      await file.close();
      // file exist, wait file expire
      const expired = await this.waitUntilExpire();
      return expired;
    } catch (e) {
      if (e.code === "ENOENT") {
        return true;
      }
      return false;
    }
  }

  public async writeSomething(): Promise<void> {
    try {
      await this.options.env.writeFile(this.filename, ``);
      this._locked = true;
    } catch (e) {}
  }

  public async lock(): Promise<void> {
    const ok = await this.waitUntilOk();
    if (!ok) {
      throw new Error("Lock fail");
    }
    await this.writeSomething();
    this.refreshLockTimer = setInterval(
      () => this.writeSomething(),
      this.stale / 2,
    );
  }
}
