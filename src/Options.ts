export type Encodings = 'string' | 'buffer' | 'json'

export interface EncodingOptions {
  keyEncoding?: Encodings
  valueEncoding?: Encodings
  prefix?: string
}

export interface Options {
  maxFileSize: number
}
