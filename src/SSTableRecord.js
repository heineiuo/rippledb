import varint from 'varint'

export default class SSTableRecoed {
  static fromBuffer (buf) {
    let keyLength = varint.decode(buf)
    let key = buf.slice(varint.decode.bytes, keyLength)
    let valueLength = varint.decode(buf, varint.decode.bytes + keyLength)
    let value = buf.slice(varint.decode.bytes, valueLength)
    return new SSTableRecoed({
      key: String(key),
      value: String(value)
    })
  }

  constructor (key, value) {
    this._key = key
    this._value = value
  }

  get key () {
    return this._key
  }

  get value () {
    return this._value
  }

  /**
   * [key_length, key, value_length, value]
   */
  toBuffer () {
    const keyLength = varint.encode(this.key.length)
    const valueLength = varint.encode(this.value.length)
    return Buffer.concat([
      keyLength,
      Buffer.from(this.key),
      valueLength,
      Buffer.from(this.value)
    ])
  }
}
