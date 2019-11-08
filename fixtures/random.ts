import crypto from 'crypto'

export function random(keySize = 16, valueSize = 64): [string, string] {
  const key = crypto
    .randomBytes(keySize)
    .toString('hex')
    .substr(0, keySize)
  const value = crypto
    .randomBytes(valueSize)
    .toString('hex')
    .substr(0, valueSize)
  return [key, value]
}
