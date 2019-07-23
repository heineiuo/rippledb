"use strict";

exports.__esModule = true;
exports.FileType = void 0;

var _enum = _interopRequireDefault(require("enum"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
const FileType = new _enum.default(['kLogFile', 'kDBLockFile', 'kTableFile', 'kDescriptorFile', 'kCurrentFile', 'kTempFile', 'kInfoLogFile' // Either the current one, or an old one
]);
exports.FileType = FileType;