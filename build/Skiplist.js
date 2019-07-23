"use strict";

exports.__esModule = true;
exports.default = void 0;

var _assert = _interopRequireDefault(require("assert"));

var _bufferEqual = _interopRequireDefault(require("buffer-equal"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _awaitAsyncGenerator(value) { return new _AwaitValue(value); }

function _wrapAsyncGenerator(fn) { return function () { return new _AsyncGenerator(fn.apply(this, arguments)); }; }

function _AsyncGenerator(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue(value) { this.wrapped = value; }

const P = 1 / Math.E;
/**
 * 
 * @param {string|Buffer} a 
 * @param {string|Buffer} b 
 * @returns {boolean} isEqual
 */

function isEqual(a, b) {
  if (!(Buffer.isBuffer(a) && Buffer.isBuffer(b))) return a === b;
  return (0, _bufferEqual.default)(a, b);
}

class SkiplistNode {
  /**
   * 
   * @param {number} maxlevel 
   * @param {SkiplistNode} next 
   * @param {string|Buffer} key 
   * @param {string|Buffer} value 
   */
  constructor(maxlevel, next, key, value) {
    this.key = key;
    this.value = value;
    this.maxlevel = maxlevel;
    this.levels = new Array(maxlevel + 1);
    this.fill(next);
  }
  /**
   * 
   * @param {SkiplistNode} next 
   */


  fill(next) {
    for (let i = 0; i <= this.maxlevel; i++) {
      this.levels[i] = next;
    }
  }

  forEach(cb) {
    for (let i = 0; i <= this.maxlevel; i++) {
      cb(this.levels[i], i);
    }
  }

  next() {
    return this.levels[0];
  }

}

class Skiplist {
  /**
   * 
   * @param {number} maxsize 
   */
  constructor(maxsize) {
    this.maxsize = maxsize || 65535;
    this.maxlevel = Math.round(Math.log(this.maxsize, 2));
    this.level = 0; // 开局的时候，tail是NIL， head指向tail
    // [] -------> []
    // [] -------> []
    // [] -------> []
    // [] -------> []
    // [] -------> []
    // head       tail

    this.tail = new SkiplistNode(this.maxlevel);
    this.tail.fill(this.tail);
    this.head = new SkiplistNode(this.maxlevel, this.tail);
  }
  /**
   * @returns {number} randomLevel
   */


  randomLevel() {
    let randomLevel = 0;
    const max = Math.min(this.maxlevel, this.level + 1);

    while (Math.random() < P && randomLevel < max) {
      randomLevel++;
    }

    return randomLevel;
  }
  /**
   * 
   * @param {string|Buffer} key 
   * @param {SkiplistNode[]} update 
   */


  findLess(key, update = []) {
    let level = this.maxlevel;
    let prev = this.head;
    let current = prev.levels[level]; // let times = 0

    while (level >= 0) {
      // times ++
      (0, _assert.default)(prev.levels.length > level, 'prev level length must bigger then level');
      update[level] = prev;
      current = prev.levels[level]; // 如果当前节点的next节点是this.tail
      //  如果level已经是0，则循环结束，说明插入节点最大，
      //  否则继续向下查找
      //  如果key比下一个节点的key小，则循环结束
      //   如果next节点的key比插入节点小，则查找next节点是否存在
      //   next节点且比key大

      if (!(current === this.tail) && current.key < key) {
        prev = current;
        continue;
      }

      level--;
    } // console.log(`${key} find times: ${times}`)


    return prev;
  }

  findGreator() {}
  /**
   * 
   * @param {string|Buffer} key 
   * @returns {SkiplistNode} node
   */


  get(key) {
    let prev = this.fineLess(key);
    if (!prev) return null;
    let current = prev.next();
    if (isEqual(current.key, key)) return current.value;
    return null;
  }
  /**
   * 
   * @param {string|Buffer} key 
   */


  del(key) {
    let update = new Array(this.maxlevel + 1);
    let prev = this.fineLess(key, update);
    if (!prev) return null;
    let node = prev.next();
    if (!isEqual(node.key, key)) return;

    for (let i = 0; i <= node.maxlevel; i++) {
      if (update[i]) {
        update[i].levels[i] = node.levels[i];
      }
    }
  }

  iterator() {
    return _wrapAsyncGenerator(function* () {})();
  }
  /**
   * 
   * @param {string|Buffer} key 
   * @param {string|Buffer} value 
   */


  put(key, value) {
    let update = new Array(this.maxlevel + 1);
    let prev = this.fineLess(key, update);

    if (isEqual(prev.key, key)) {
      prev.value = value;
    } else {
      const randomLevel = this.randomLevel();
      this.level = Math.max(randomLevel, this.level); // console.log(`randomLevel, ${randomLevel}`)

      const node = new SkiplistNode(randomLevel, prev.next(), key, value);

      for (let i = 0; i <= randomLevel; i++) {
        if (update[i]) {
          node.levels[i] = update[i].levels[i];
          update[i].levels[i] = node;
        } // prev.levels[i] = node

      }
    }
  }

  length() {}

}

var _default = Skiplist;
exports.default = _default;