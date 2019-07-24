import varint from 'varint'
import { subbuf } from './LevelUtils'

export default class SSTableRecoed {
  static fromBuffer (rawbuf) {
    let buf = subbuf(rawbuf)
    let keyLength = varint.decode(buf)
    let keyStartIndex = varint.decode.bytes
    let key = buf.slice(keyStartIndex, keyStartIndex + keyLength)
    let valueLength = varint.decode(buf, keyStartIndex + keyLength)
    let valueStartIndex = keyStartIndex + keyLength + varint.decode.bytes
    let value = buf.slice(valueStartIndex, valueStartIndex + valueLength)
    return new SSTableRecoed({
      key: String(key),
      value: String(value)
    })
  }

  constructor ({ key, value }) {
    this._key = key
    this._value = value
  }

  get key () {
    return this._key
  }

  get value () {
    return this._value
  }

  set key (next) {
    this._key = next
  }

  set value (next) {
    this._value = next
  }

  /**
   * [key_length, key, value_length, value]
   */
  toBuffer () {
    const keyLength = varint.encode(this.key.length)
    const valueLength = varint.encode(this.value.length)
    return Buffer.concat([
      Buffer.from(keyLength),
      Buffer.from(this.key),
      Buffer.from(valueLength),
      Buffer.from(this.value)
    ])
  }
}
