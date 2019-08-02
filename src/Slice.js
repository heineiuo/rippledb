import { Buffer } from 'buffer'

export default class Slice {
  _buffer:Buffer

  constructor (value:string|Buffer) {
    this._buffer = Buffer.isBuffer(value) ? value : Buffer.from(value)
  }

  compare (slice:Slice):number {
    return this._buffer.compare(slice)
  }
}
