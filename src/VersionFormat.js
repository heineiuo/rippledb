
import { ValueType } from './Format'
import varint from 'varint'
import Slice from './Slice'
import SequenceNumber from './SequenceNumber'

export class InternalKey extends Slice {

}

export class InternalKeyBuilder {
  build (sequence:SequenceNumber, valueType:ValueType, key:Slice):InternalKey {
    /**
     * encoded(internal_key_size) | key | sequence(7Bytes) | type (1Byte) | encoded(value_size) | value
     * 1. Lookup key/ Memtable Key: encoded(internal_key_size) --- type(1Byte)
     * 2. Internal key: key --- type(1Byte)
     * 3. User key: key
     */
    const slice = new Slice(Buffer.concat([
      key.buffer,
      sequence.toFixedSizeBuffer(),
      Buffer.from(varint.encode(valueType.value))
    ]))
    return new InternalKey(slice)
  }
}

export class InternalKeyComparator {

}

export class BySmallestKey {
  internalComparator:any
  // constructor () {

  // }

  operator (key1: InternalKey, key2: InternalKey) {

  }
}

// 能自动排序的set（根据internalkey comparator排序，如果small key相同，则比较file number
export class FileSet {
  compare: BySmallestKey

  constructor (cmp:BySmallestKey) {
    this.compare = cmp
    this._set = []
  }

  add (file: FileMetaData) {
    if (this._set.find(item => item === file)) {
      return
    }
    this._set.push(file)
  }

  delete (file:FileMetaData) {
    this._set = this._set.filter(item => item !== file)
  }
}

export type FileMetaDataLeveldb = {
  fileNum:number,
  fileSize:number,
  smallestKey:InternalKey,
  largestKey:InternalKey
}

export default class FileMetaData {
  // reference count
  refs: number
  // if seeks > allowedSeeks, trigger compaction
  allowedSeeks: number
  number: number
  fileSize: number
  smallest: InternalKey
  largest: InternalKey

  constructor (args: any) {
    this.refs = args.refs
    this.allowedSeeks = args.allowedSeeks
    this.number = args.number
    this.fileSize = args.fileSize
    this.smallest = new InternalKey(args.smallest)
    this.largest = new InternalKey(args.largest)
  }

  set refs (value:number) {
    this._refs = value
  }

  get refs () {
    return this._refs
  }
}

export type CompactPointer = {
  level:number,
  internalKey:InternalKey
}

export type DeletedFile = {
  level: number,
  fileNum: number
}

export type NewFile = {
  level:number,
  fileMetaData: FileMetaData
}
