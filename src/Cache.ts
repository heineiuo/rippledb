/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import LRUCache from "../third_party/lru-cache";

export default class Cache<K, V> extends LRUCache<K, V> {
  constructor(options?: LRUCache.Options<K, V>) {
    super(options);
  }

  private _id = 0n;

  newId(): bigint {
    return ++this._id;
  }
}
