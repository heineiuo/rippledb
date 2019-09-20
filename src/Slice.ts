import { Buffer } from 'buffer'
import { Encodings } from './Options'

/**
 * 作为参数传递，减少不必要的拷贝
 */
export default class Slice {
  static defaultValue: Buffer = Buffer.alloc(0)

  _inputType: Encodings
  _buffer: Buffer

  constructor(value: any = Slice.defaultValue) {
    if (value instanceof Slice) {
      this._inputType = value._inputType
      this._buffer = value._buffer
    } else if (Buffer.isBuffer(value)) {
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
  get buffer(): Buffer {
    return this._buffer
  }

  set buffer(buf: Buffer) {
    this._buffer = buf
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

  set data(buf: any) {
    this._buffer = buf
  }

  toString(encoding?: Encodings): string {
    return this._buffer.toString(encoding)
  }

  clear() {
    // this._inputType = 'buffer'
    this._buffer = Buffer.alloc(0)
  }

  compare(slice: Slice): number {
    return this._buffer.compare(slice.buffer)
  }
}
