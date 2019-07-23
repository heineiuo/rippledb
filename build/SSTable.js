"use strict";

exports.__esModule = true;
exports.default = void 0;

var _fs = _interopRequireDefault(require("fs"));

var _TableFooter = _interopRequireDefault(require("./TableFooter"));

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

class SSTable {
  static async fromFile(filePath) {
    const buf = await _fs.default.readFile(filePath);

    const footer = _TableFooter.default.fromFile(buf);

    const table = new SSTable({
      footer
    });
    return table;
  }

  constructor(options) {
    _defineProperty(this, "getMetaIndex", () => {});

    _defineProperty(this, "getIndex", () => {});

    this.footer = options.footer;
  }

  append() {}

  keyIterator() {
    return _wrapAsyncGenerator(function* () {})();
  }

  blockIterator() {
    return _wrapAsyncGenerator(function* () {})();
  }

}
/** 
 * Create a sstable class
 * @constructor
 */


var _default = SSTable;
exports.default = _default;