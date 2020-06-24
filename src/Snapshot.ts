/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SequenceNumber } from "./Format";
import { assert } from "./DBHelper";

export class Snapshot {
  constructor(sn: SequenceNumber) {
    this._sequenceNumber = sn;
  }

  _sequenceNumber: SequenceNumber;
  _next!: Snapshot;
  _prev!: Snapshot;

  get sequenceNumber(): SequenceNumber {
    return this._sequenceNumber;
  }
}

export class SnapshotList {
  constructor() {
    this._head = new Snapshot(0n);
    this._head._next = this._head;
    this._head._prev = this._head;
  }

  _head: Snapshot;

  isEmpty(): boolean {
    return this._head._next === this._head;
  }

  newest(): Snapshot {
    assert(!this.isEmpty());
    return this._head._prev;
  }

  oldest(): Snapshot {
    assert(!this.isEmpty());
    return this._head._next;
  }

  // insert before _head
  insert(sn: SequenceNumber): Snapshot {
    assert(this.isEmpty() || this.newest()._sequenceNumber <= sn);
    const snapshot = new Snapshot(sn);
    snapshot._next = this._head;
    snapshot._prev = this._head._prev;
    snapshot._prev._next = snapshot;
    snapshot._next._prev = snapshot;
    return snapshot;
  }

  delete(snapshot: Snapshot): void {
    const next = snapshot._next;
    const prev = snapshot._prev;
    next._prev = prev;
    prev._next = next;
  }
}
