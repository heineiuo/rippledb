/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @flow
// import { Buffer } from 'buffer'
import SSTableBlock from './SSTableBlock'

export default class TableDataBlock extends SSTableBlock {
  blockType:string = 'TableDataBlock'
}
