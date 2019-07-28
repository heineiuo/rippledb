import varint from 'varint'
import { Buffer } from 'buffer'
import BloomFilter from './BloomFilter'

/**
 * The "metaindex" block contains an entry that maps from filter.<N>
 * to the BlockHandle for the filter block where <N> is the string
 * returned by the filter policy's Name() method.
 *
 * [filter 0]
 * [filter 1]
 * [filter 2]
 * ...
 * [filter N-1]
 * [offset of filter 0] : 4 bytes
 * [offset of filter 1] : 4 bytes
 * [offset of filter 2] : 4 bytes
 * ...
 * [offset of filter N-1] : 4 bytes
 * [offset of beginning of offset array] : 4 bytes
 * lg(base) : 1 byte
 */
export default class SSTableMetaBlock {
  constructor (buffer:Buffer, offset?:number, size?:number) {
    this._buffer = buffer || Buffer.from([])
    this._offset = offset || 0
    this._size = size || 0
  }

  get filter () {

  }

  get buffer ():Buffer {
    return this._buffer
  }

  * iterator () {
    const offsetIterator = this.offsetIterator()
    let offsetResult = offsetIterator.next()
    while (!offsetResult.done) {
      const beginningOfFilter = offsetResult.value
      const filter = new BloomFilter(this._buffer.slice(beginningOfFilter + this._offset))
      offsetResult = offsetIterator.next()
    }
  }

  * offsetIterator () {
    const start = this.beginningOfOffset
    const offsetTotalCount = this._size - 5 - start
    let count = 0
    while (count < offsetTotalCount) {
      yield varint.decode(this._buffer.slice(start + count))
      count += 4
    }
  }

  get beginningOfOffset ():number {
    let buf
    if (this._offset === 0 && this._size === this._buffer.length) {
      buf = this._buffer
    } else {
      buf = this._buffer.slice(this._offset, this._size)
    }
    return varint.decode(buf, buf.length - 5)
  }

  get baseLg ():number {
    return 11
  }
}
