import varint from 'varint'

function getSize (buffer, offset = 0) {
  if (buffer.length === 0) return 0
  const buf = buffer.slice(offset)
  const keyLength = varint.decode(buf)
  const keyStartIndex = varint.decode.bytes
  const valueLength = varint.decode(buf, keyStartIndex + keyLength)
  const valueStartIndex = keyStartIndex + keyLength + varint.decode.bytes
  return valueStartIndex + valueLength
}

export default class SSTableRecord {
  constructor (buffer, offset, size) {
    this._buffer = buffer || Buffer.from([])
    this._offset = offset || 0
    this._size = size || getSize(this._buffer, this._offset)
  }

  get size () {
    return this._size
  }

  get buffer () {
    return this._buffer
  }

  get offset () {
    return this._offset
  }

  /**
   *
   * @param {("utf8"|null)} encoding
   * @returns {object}
   */
  get (encoding = 'utf8') {
    if (this._size === 0) return { key: null, value: null }
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
      this._size = this._buffer.length
    }
  }
}
