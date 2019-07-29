// https://github.com/wiedi/node-bitbuffer

import { Buffer } from 'buffer'

export default class BitBuffer {
  /**
   * Buffer length should be Math.ceil(bits / 8)
   */
  constructor (buffer:Buffer) {
    this._buffer = buffer
    this._size = buffer.length
  }

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

  set (index:number, bool:boolean) {
    const pos = index >>> 3
    if (bool) {
      this._buffer[pos] |= 1 << (index % 8)
    } else {
      this._buffer[pos] &= ~(1 << (index % 8))
    }
  }

  toggle (index:number) {
    this._buffer[index >>> 3] ^= 1 << (index % 8)
  }

  get (index:number):boolean {
    return (this._buffer[index >>> 3] & (1 << (index % 8))) !== 0
  }
}
