/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WriteBatch } from "./WriteBatch";

export class Writer {
  batch!: WriteBatch | void;
  sync = false;
  done = false;

  resolve!: () => void;

  signal(): void {
    if (this.resolve) this.resolve();
    delete this.resolve;
  }

  wait(): Promise<void> {
    delete this.resolve;
    return new Promise((resolve) => (this.resolve = resolve));
  }
}

export class WriterQueue {
  private list: Writer[] = [];

  public push(writer: Writer): void {
    this.list.push(writer);
  }

  public front(): Writer | void {
    return this.list[0];
  }

  public popFront(): void {
    this.list.shift();
  }

  get length(): number {
    return this.list.length;
  }

  *iterator(start = 0): IterableIterator<Writer> {
    for (let i = start; i < this.list.length; i++) {
      yield this.list[i];
    }
  }
}
