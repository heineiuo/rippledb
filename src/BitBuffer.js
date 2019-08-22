// https://github.com/wiedi/node-bitbuffer
// @flow
import { Buffer } from 'buffer'

export default class BitBuffer {
  /**
   * Buffer length should be Math.ceil(bits / 8)
   */
  constructor (buffer:Buffer) {
    this._buffer = buffer
    this._size = buffer.length
  }

  _size:number
  _buffer:Buffer

  get buffer ():Buffer {
    return this._buffer
  }

  get size ():number {
    return this._size
  }

  get bits ():number {
    // return (this.size - (this.size % 8)) * 8
    return this.size * 8
  }

  resizeBits (bits:number):void {
    const nextSize = Math.ceil(bits / 8)
    if (nextSize > this.size) {
      this._buffer = Buffer.concat([
        this._buffer,
        Buffer.alloc(nextSize - this.size)
      ])
      this._size = this._buffer.length
    } else if (nextSize < this.size) {
      this._buffer = this._buffer.slice(0, nextSize)
      this._size = this._buffer.length
    }
  }

  set (index:number, bool:boolean) {
    const pos = index >>> 3
    if (bool) {
      this._buffer[pos] |= 1 << (index % 8)
    } else {
      this._buffer[pos] &= ~(1 << (index % 8))
    }
  }

  toggle (index:number):void {
    this._buffer[index >>> 3] ^= 1 << (index % 8)
  }

  get (index:number):boolean {
    return (this._buffer[index >>> 3] & (1 << (index % 8))) !== 0
  }

  toString ():string {
    let str = ''
    for (let i = 0; i < this.bits; i++) {
      str += this.get(i) ? '1' : '0'
    }
    return str
  }
}
