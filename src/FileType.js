/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Enum from 'enum'


const FileType = new Enum([
  'kLogFile',
  'kDBLockFile',
  'kTableFile',
  'kDescriptorFile',
  'kCurrentFile',
  'kTempFile',
  'kInfoLogFile' // Either the current one, or an old one
])