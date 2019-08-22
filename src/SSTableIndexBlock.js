/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

//@flow

// import { Buffer } from 'buffer'
import varint from 'varint'
import SSTableBlock from './SSTableBlock'
import SSTableDataBlock from './SSTableDataBlock'

export default class TableIndexBlock extends SSTableBlock {
  * dataBlockIterator () {
    const iterator = this.iterator('buffer')
    let dataBlockIndexRecord = iterator.next()
    while (!dataBlockIndexRecord.done) {
      // console.log('dataBlockIndexRecord loop times')

      // yield dataBlockIndexRecord.value

      /**
       * key=max key of data block
       * value=data block offset,size
       */
      const { value } = dataBlockIndexRecord.value
      const offset = varint.decode(value)
      const size = varint.decode(value, varint.decode.bytes)
      const dataBlock = new SSTableDataBlock(this.buffer, offset, size)
      // console.log('dataBlockIterator', [this._offset, this._size], [offset, size])

      yield * dataBlock.iterator()

      // const iterator2 = dataBlock.iterator()
      // let dataBlockRecord = iterator2.next()
      // while (!dataBlockRecord.done) {
      //   yield dataBlockRecord.value
      //   dataBlockRecord = iterator2.next()
      // }

      dataBlockIndexRecord = iterator.next()
      // console.log(dataBlockIndexRecord)
    }
  }

  * indexIterator () {
    const iterator = this.iterator('buffer')
    let dataBlockIndexRecord = iterator.next()
    while (!dataBlockIndexRecord.done) {
      const { key, value } = dataBlockIndexRecord.value
      const offset = varint.decode(value)
      const size = varint.decode(value, varint.decode.bytes)
      yield {
        key: key.toString(),
        offset,
        size
      }
      dataBlockIndexRecord = iterator.next()
    }
  }
}
