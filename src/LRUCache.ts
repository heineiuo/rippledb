import { Yallist, YallistNode } from "./Yallist";

const MAX = Symbol("max");
const LENGTH = Symbol("length");
const LENGTH_CALCULATOR = Symbol("lengthCalculator");
const ALLOW_STALE = Symbol("allowStale");
const MAX_AGE = Symbol("maxAge");
const DISPOSE = Symbol("dispose");
const NO_DISPOSE_ON_SET = Symbol("noDisposeOnSet");
const LRU_LIST = Symbol("lruList");
const CACHE = Symbol("cache");
const UPDATE_AGE_ON_GET = Symbol("updateAgeOnGet");

const naiveLength = (): number => 1;

export interface LRUCacheOptions<K, V> {
  /**
   * The maximum size of the cache, checked by applying the length
   * function to all values in the cache. Not setting this is kind of silly,
   * since that's the whole purpose of this lib, but it defaults to `Infinity`.
   */
  max?: number;

  /**
   * Maximum age in ms. Items are not pro-actively pruned out as they age,
   * but if you try to get an item that is too old, it'll drop it and return
   * undefined instead of giving it to you.
   */
  maxAge?: number;

  /**
   * Function that is used to calculate the length of stored items.
   * If you're storing strings or buffers, then you probably want to do
   * something like `function(n, key){return n.length}`. The default
   * is `function(){return 1}`, which is fine if you want to store
   * `max` like-sized things. The item is passed as the first argument,
   * and the key is passed as the second argument.
   */
  length?(value: V, key?: K): number;

  /**
   * Function that is called on items when they are dropped from the cache.
   * This can be handy if you want to close file descriptors or do other
   * cleanup tasks when items are no longer accessible. Called with `key, value`.
   * It's called before actually removing the item from the internal cache,
   * so if you want to immediately put it back in, you'll have to do that in
   * a `nextTick` or `setTimeout` callback or it won't do anything.
   */
  dispose?(key: K, value: V): void;

  /**
   * By default, if you set a `maxAge`, it'll only actually pull stale items
   * out of the cache when you `get(key)`. (That is, it's not pre-emptively
   * doing a `setTimeout` or anything.) If you set `stale:true`, it'll return
   * the stale value before deleting it. If you don't set this, then it'll
   * return `undefined` when you try to get a stale entry,
   * as if it had already been deleted.
   */
  stale?: boolean;

  /**
   * By default, if you set a `dispose()` method, then it'll be called whenever
   * a `set()` operation overwrites an existing key. If you set this option,
   * `dispose()` will only be called when a key falls out of the cache,
   * not when it is overwritten.
   */
  noDisposeOnSet?: boolean;

  /**
   * When using time-expiring entries with `maxAge`, setting this to `true` will make each
   * item's effective time update to the current time whenever it is retrieved from cache,
   * causing it to not expire. (It can still fall out of cache based on recency of use, of
   * course.)
   */
  updateAgeOnGet?: boolean;
}

class Entry<K, V> {
  constructor(key: K, value: V, length: number, now: number, maxAge: number) {
    this.key = key;
    this.value = value;
    this.length = length;
    this.now = now;
    this.maxAge = maxAge || 0;
  }

  key: K;
  value: V;
  length: number;
  now: number;
  maxAge: number;
}

// lruList is a yallist where the head is the youngest
// item, and the tail is the oldest.  the list contains the Hit
// objects as the entries.
// Each Hit object has a reference to its Yallist.Node.  This
// never changes.
//
// cache is a Map (or PseudoMap) that matches the keys to
// the Yallist.Node object.
export class LRUCache<K, V> {
  constructor(options: LRUCacheOptions<K, V> = {}) {
    if (options.max && (typeof options.max !== "number" || options.max < 0))
      throw new TypeError("max must be a non-negative number");
    // Kind of weird to have a default max of Infinity, but oh well.
    this[MAX] = options.max || Infinity;

    const lc = options.length || naiveLength;
    this[LENGTH_CALCULATOR] = typeof lc !== "function" ? naiveLength : lc;
    this[ALLOW_STALE] = options.stale || false;
    if (options.maxAge && typeof options.maxAge !== "number")
      throw new TypeError("maxAge must be a number");
    this[MAX_AGE] = options.maxAge || 0;
    this[DISPOSE] = options.dispose;
    this[NO_DISPOSE_ON_SET] = options.noDisposeOnSet || false;
    this[UPDATE_AGE_ON_GET] = options.updateAgeOnGet || false;
    this.reset();
  }

  [LENGTH] = 0;
  [LENGTH_CALCULATOR]: (value: V, key?: K) => number;
  [MAX]: number;
  [ALLOW_STALE]: boolean;
  [MAX_AGE]: number;
  [DISPOSE]?: (key: K, value: V) => void;
  [NO_DISPOSE_ON_SET]: boolean;
  [UPDATE_AGE_ON_GET]: boolean;
  [LRU_LIST]: Yallist<Entry<K, V>>;
  [CACHE] = new Map<K, YallistNode<Entry<K, V>>>();

  reset(): void {
    const dispose = this[DISPOSE];
    if (dispose) {
      if (this[LRU_LIST] && this[LRU_LIST].length) {
        this[LRU_LIST].forEach((hit) => dispose(hit.key, hit.value));
      }
    }

    this[CACHE] = new Map(); // hash of items by key
    this[LRU_LIST] = new Yallist(); // list of items in order of use recency
    this[LENGTH] = 0; // length of items in the list
  }

  set(key: K, value: V, maxAge?: number): boolean {
    maxAge = maxAge || this[MAX_AGE];

    if (maxAge && typeof maxAge !== "number")
      throw new TypeError("maxAge must be a number");

    const now = maxAge ? Date.now() : 0;
    const len = this[LENGTH_CALCULATOR](value, key);
    const dispose = this[DISPOSE];

    // ts cannot handle Map.has and Map.get.
    const entry = this[CACHE].get(key);
    if (entry) {
      if (len > this[MAX]) {
        this.del(entry);
        return false;
      }

      const node = this[CACHE].get(key);

      // @ts-ignore // ts cannot handle Map.has, Map.get
      const item = node.value;

      // dispose of the old one before overwriting
      // split out into 2 ifs for better coverage tracking
      if (dispose) {
        if (!this[NO_DISPOSE_ON_SET]) dispose(key, item.value);
      }

      item.now = now;
      item.maxAge = maxAge;
      item.value = value;
      this[LENGTH] += len - item.length;
      item.length = len;
      this.get(key);
      this.trim();
      return true;
    }

    const hit = new Entry(key, value, len, now, maxAge);

    // oversized objects fall out of cache automatically.
    if (hit.length > this[MAX]) {
      if (dispose) dispose(key, value);

      return false;
    }

    this[LENGTH] += hit.length;
    this[LRU_LIST].unshift(hit);
    this[CACHE].set(key, this[LRU_LIST].head as YallistNode<Entry<K, V>>);
    this.trim();
    return true;
  }

  del(node: YallistNode<Entry<K, V>>): void {
    if (node) {
      const dispose = this[DISPOSE];
      const hit = node.value;
      if (dispose) dispose(hit.key, hit.value);

      this[LENGTH] -= hit.length;
      this[CACHE].delete(hit.key);
      this[LRU_LIST].removeNode(node);
    }
  }

  isStale(hit: Entry<K, V>): boolean {
    if (!hit || (!hit.maxAge && !this[MAX_AGE])) return false;

    const diff = Date.now() - hit.now;
    if (hit.maxAge) {
      return diff > hit.maxAge;
    }

    return diff > this[MAX_AGE];
  }

  trim(): void {
    if (this[LENGTH] > this[MAX]) {
      for (
        let walker = this[LRU_LIST].tail;
        this[LENGTH] > this[MAX] && walker !== null;

      ) {
        // We know that we're about to delete this one, and also
        // what the next least recently used key will be, so just
        // go ahead and set it now.
        const prev = walker.prev;
        this.del(walker);
        walker = prev;
      }
    }
  }

  get(key: K, doUse = false): V | void {
    const node = this[CACHE].get(key);
    if (node) {
      const hit = node.value;
      if (this.isStale(hit)) {
        this.del(node);
        if (!this[ALLOW_STALE]) return;
      } else {
        if (doUse) {
          if (this[UPDATE_AGE_ON_GET]) node.value.now = Date.now();
          this[LRU_LIST].unshiftNode(node);
        }
      }
      return hit.value;
    }
  }
}
