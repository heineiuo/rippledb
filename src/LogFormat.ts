/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */


export function createHexStringFromDecimal (decimal:number):string {
  let str = decimal.toString(16)
  while (str.length < 4) {
    str = `0${str}`
  }
  return str
}
