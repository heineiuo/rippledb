/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SequenceNumber } from './Format'

export class Snapshot {
  private _sequenceNumber: SequenceNumber
  next!: Snapshot
  prev!: Snapshot

  constructor(sn: SequenceNumber) {
    this._sequenceNumber = sn
  }

  get sequenceNumber(): SequenceNumber {
    return this._sequenceNumber
  }
}

export class SnapshotList {
  oldest(): Snapshot {
    // TODO
    return new Snapshot(new SequenceNumber())
  }
}
