"use strict";

exports.__esModule = true;
exports.default = void 0;

var _MemTable = _interopRequireDefault(require("./MemTable"));

var _Log = _interopRequireDefault(require("./Log"));

var _SequenceNumber = _interopRequireDefault(require("./SequenceNumber"));

var _lruCache = _interopRequireDefault(require("lru-cache"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _awaitAsyncGenerator(value) { return new _AwaitValue(value); }

function _wrapAsyncGenerator(fn) { return function () { return new _AsyncGenerator(fn.apply(this, arguments)); }; }

function _AsyncGenerator(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue(value) { this.wrapped = value; }

class Database {
  constructor(dbpath) {
    _defineProperty(this, "_viewLog", () => {});

    this._log = new _Log.default(dbpath);
    this._mem = new _MemTable.default();
    this._sn = new _SequenceNumber.default(0);
    this._cache = (0, _lruCache.default)({
      max: 500,
      length: function (n, key) {
        return n * 2 + key.length;
      },
      dispose: function (key, n) {
        n.close();
      },
      maxAge: 1000 * 60 * 60
    });
    this.recovery();
  }

  recovery() {
    this._log.readLogRecord(0);
  }

  iterator(options) {
    return _wrapAsyncGenerator(function* () {})();
  }

  async get(key) {
    return this._cache.get(key);
  }

  async put(key, value) {
    return this._cache.set(key, value);
  }

  async del(key) {
    return this._cache.del(key);
  }

  createReadStream(options) {}

}

var _default = Database;
exports.default = _default;