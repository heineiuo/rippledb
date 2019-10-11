import crypto from 'crypto'

export function random(keySize = 16, valueSize = 64) {
  const key = crypto.randomBytes(keySize).toString('hex')
  const value = crypto.randomBytes(valueSize).toString('hex')
  return [key, value]
}
