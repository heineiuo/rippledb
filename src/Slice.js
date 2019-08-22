//@flow

import { Buffer } from 'buffer'

type Encoding = 'buffer' | 'string' | 'json'

/**
 * 作为参数传递，减少不必要的拷贝
 */
export default class Slice {

  static defaultValue:Buffer = Buffer.alloc(0)

  constructor(value: any = Slice.defaultValue) {
    if (value instanceof Slice) {
      return value
    } 
    if (Buffer.isBuffer(value)) {
      this._inputType = 'buffer'
      this._buffer = value
    } else if (typeof value === 'string') {
      this._inputType = 'string'
      this._buffer = Buffer.from(value)
    } else {
      this._inputType = 'json'
      this._buffer = Buffer.from(JSON.stringify(value))
    }
  }

  _inputType: Encoding
  _buffer: Buffer

  get buffer(): Buffer {
    return this._buffer
  }

  get length(): number {
    return this._buffer.length
  }

  get size(): number {
    return this._buffer.length
  }

  get data(): any {
    if (this._inputType === 'string') {
      return this._buffer.toString()
    } else if (this._inputType === 'json') {
      return JSON.parse(this._buffer.toString())
    } else {
      return this._buffer
    }
  }

  toString(encoding: Encoding):string {
    return this._buffer.toString(encoding)
  }

  compare(slice: Slice): number {
    return this._buffer.compare(slice)
  }
}
