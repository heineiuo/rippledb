import varint from 'varint'
import { subbuf } from './LevelUtils'

export default class SSTableRecord {
  constructor (buffer, offset) {
    // if (buffer) console.log([`sstable record constructure`, buffer.length,'offset', offset])
    this._buffer = buffer
    this._offset = offset
    // if (buffer) {
    //   const data = this.get()
    //   this.put(data.key, data.value)
    // }
  }

  get length () {
    if (!this._buffer) return 0
    const buf = this._buffer.slice(this._offset)
    const keyLength = varint.decode(buf)
    const keyStartIndex = varint.decode.bytes
    const valueLength = varint.decode(buf, keyStartIndex + keyLength)
    const valueStartIndex = keyStartIndex + keyLength + varint.decode.bytes
    return valueStartIndex + valueLength
  }

  get buffer () {
    return this._buffer
  }

  /**
   *
   * @param {("utf8"|null)} encoding
   * @returns {object}
   */
  get (encoding = 'utf8') {
    if (!this._buffer) return { key: null, value: null }
    const keyLength = varint.decode(this._buffer, this._offset)
    const keyStartIndex = varint.decode.bytes
    const key = this._buffer.slice(this._offset + keyStartIndex, this._offset + keyStartIndex + keyLength)
    const valueLength = varint.decode(this._buffer, this._offset + keyStartIndex + keyLength)
    const valueStartIndex = keyStartIndex + keyLength + varint.decode.bytes
    const value = this._buffer.slice(this._offset + valueStartIndex, this._offset + valueStartIndex + valueLength)

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
   * @param {any} key
   * @param {any} value
   */
  put (key, value) {
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
    }
  }
}
