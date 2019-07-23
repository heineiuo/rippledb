"use strict";

exports.__esModule = true;
exports.default = void 0;

var _path = _interopRequireDefault(require("path"));

var _fs = _interopRequireDefault(require("fs"));

var _Skiplist = _interopRequireDefault(require("./Skiplist"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

class MemTable {
  constructor() {
    _defineProperty(this, "get", function* () {});

    _defineProperty(this, "createInterator", function* () {});

    this._list = new _Skiplist.default();
  }

  encodeBuf() {}

  decodeBuf() {}

  put(sn, valueType, key, value) {}

}

var _default = MemTable;
exports.default = _default;