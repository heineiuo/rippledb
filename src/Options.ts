// @flow

export type Encodings = 'string' | 'buffer' | 'json'

export type Options = {
  keyEncoding?: Encodings
  valueEncoding?: Encodings
  prefix?: string
}
