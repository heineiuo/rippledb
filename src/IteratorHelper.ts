/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class IteratorHelper {
  static wrap<T>(
    iterator: IterableIterator<T>,
    callback: (value: T) => void
  ): IterableIterator<T>
  static wrap<T>(
    iterator: AsyncIterableIterator<T>,
    callback: (value: T) => void
  ): AsyncIterableIterator<T>
  static wrap<T>(
    iterator: IterableIterator<T> | AsyncIterableIterator<T>,
    callback: (value: T) => void
  ): IterableIterator<T> | AsyncIterableIterator<T> {
    if (Symbol.iterator in iterator) {
      const it = iterator as IterableIterator<T>
      it.return = (): IteratorResult<T> => {
        const value = it.next().value
        callback(value)
        return { done: true, value }
      }
      return it
    }

    iterator.return = async (): Promise<IteratorResult<T>> => {
      try {
        const value = (await iterator.next()).value
        callback(value)
        return { done: true, value }
      } catch (e) {
        callback(e)
        return { done: true, value: e }
      }
    }
    return iterator
  }

  static makeAsync<T>(iterator: IterableIterator<T>): AsyncIterableIterator<T> {
    const asyncIter = {
      return: async (value?: any): Promise<IteratorResult<T>> => {
        try {
          const value = iterator.next().value
          return { done: true, value }
        } catch (e) {
          return { done: true, value: e }
        }
      },
      next: async (value?: any): Promise<IteratorResult<T>> => {
        return iterator.next()
      },
    } as AsyncIterableIterator<T>

    return {
      next: asyncIter.next,
      [Symbol.asyncIterator](): AsyncIterableIterator<T> {
        return asyncIter
      },
    }
  }
}
