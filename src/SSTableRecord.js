import varint from 'varint'
import { Buffer } from 'buffer'

function getSize (buffer:Buffer, offset:number = 0):number {
  if (buffer.length === 0) return 0
  const buf = buffer.slice(offset)
  const keyLength = varint.decode(buf)
  const keyStartIndex = varint.decode.bytes
  const valueLength = varint.decode(buf, keyStartIndex + keyLength)
  const valueStartIndex = keyStartIndex + keyLength + varint.decode.bytes
  return valueStartIndex + valueLength
}

export default class SSTableRecord {
  constructor (buffer:Buffer, offset?:number, size?:number) {
    this._buffer = buffer || Buffer.from([])
    this._offset = offset || 0
    this._size = size || getSize(this._buffer, this._offset)
  }

  get size ():number {
    return this._size
  }

  get buffer ():Buffer {
    return this._buffer
  }

  get offset ():number {
    return this._offset
  }

  get (encoding:"utf8"|"buffer" = 'utf8'):{key:string|Buffer, value:string|Buffer} {
    if (this.size === 0) return { key: null, value: null }
    const keyLength = varint.decode(this.buffer, this.offset)
    const keyStartIndex = varint.decode.bytes
    const key = this.buffer.slice(this.offset + keyStartIndex, this.offset + keyStartIndex + keyLength)
    const valueLength = varint.decode(this.buffer, this.offset + keyStartIndex + keyLength)
    const valueStartIndex = keyStartIndex + keyLength + varint.decode.bytes
    const value = this.buffer.slice(this.offset + valueStartIndex, this.offset + valueStartIndex + valueLength)

    if (encoding === 'utf8') {
      return {
        key: String(key),
        value: String(value)
      }
    }
    return { key, value }
  }

  /**
   * [key_length, key, value_length, value]
   */
  put (key:string|Buffer, value:string|Buffer) {
    if (key && value) {
      const keyLength = varint.encode(key.length)
      const valueLength = varint.encode(value.length)
      this._buffer = Buffer.concat([
        Buffer.from(keyLength),
        Buffer.from(key),
        Buffer.from(valueLength),
        Buffer.from(value)
      ])
      this._offset = 0
      this._size = this._buffer.length
    }
  }
}
