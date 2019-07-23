/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * get part of buffer like String.substr
 * @param {Buffer} buf
 * @param {number} start
 * @param {number} len
 */
export const subbuf = (buf, start = 0, len) => {
  if (!Buffer.isBuffer(buf)) throw new TypeError('Buffer required.')
  const length = typeof len === 'undefined' ? buf.length - start : len
  const buf1 = Buffer.from({ length })
  buf.copy(buf1, 0, start, buf.length - start + length)
  return buf1
}

/**
 * get part of buffer like String.substring
 * @param {Buffer} buf
 * @param {number} start
 * @param {number} end
 */
export const subbuffer = (buf, start = 0, end) => {
  if (!Buffer.isBuffer(buf)) throw new TypeError('Buffer required.')
  const length = (typeof end === 'undefined' ? buf.length : end) - start
  const buf1 = Buffer.from({ length })
  buf.copy(buf1, 0, start, end)
  return buf1
}

/**
 *
 * @param {string} string1
 * @param {string} string2
 * @returns {string}
 */
export function findShortestSeparator (string1, string2) {
  let index = 0
  let same = ''
  let base = ''
  while (true) {
    const left = string1[index]
    const right = string2[index]
    if (!left || !right) return same
    if (left > right) {
      base = right
      break
    }
    if (left < right) {
      base = left
      break
    }
    same += left
    index++
  }
  const nextChar = String.fromCharCode(base.charCodeAt(0) + 1)
  return `${same}${nextChar}`
}
