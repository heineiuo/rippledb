/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import crc32 from 'buffer-crc32'
import assert from 'assert'
import Slice from './Slice'
import BloomFilter from './BloomFilter'
import Footer from './SSTableFooter'
import { FileHandle } from './Env'
import { encodeFixed32 } from './Coding'
import { Options } from './Options'
import {
  BlockHandle,
  CompressionTypes,
  kBlockTrailerSize,
  kSizeOfUInt32,
} from './Format'

export default class SSTableBuilder {
  constructor(options: Options, file: FileHandle, filename: string) {
    this._file = file
    this._filename = filename
    this._fileSize = 0
    this._metaBlock = new FilterBlockBuilder() // eslint-disable-line
    this._footer = new Footer(Buffer.alloc(48))
    this._numberOfEntries = 0
    this._offset = 0
    this._pendingIndexEntry = false
    this._closed = false
    this._options = options
    this._dataBlock = new BlockBuilder(this._options) // eslint-disable-line
    this._dataBlock.blockType = 'datablock'
    this._indexBlock = new BlockBuilder(this._options) // eslint-disable-line
    this._indexBlock.blockType = 'indexblock'
    this._pendingHandle = new BlockHandle()
  }

  private _closed: boolean
  private _numberOfEntries: number
  private _options: Options
  private _file: FileHandle
  private _filename: string
  private _fileSize: number
  private _lastKey!: Slice // internalkey
  private _dataBlock: BlockBuilder
  private _metaBlock: FilterBlockBuilder
  private _indexBlock: BlockBuilder
  private _footer: Footer
  private _offset: number
  private _pendingIndexEntry: boolean
  private _pendingHandle: BlockHandle

  // key is internal key
  async add(key: Slice, value: Slice): Promise<void> {
    assert(!this._closed)
    if (this._numberOfEntries > 0) {
      assert(
        this._options.comparator.compare(key, this._lastKey) > 0,
        `new key must bigger then last key`
      )
    }

    if (this._pendingIndexEntry) {
      assert(this._dataBlock.isEmpty())
      this._options.comparator.findShortestSeparator(this._lastKey, key)
      const handleEncoding = this._pendingHandle.buffer
      this._indexBlock.add(this._lastKey, new Slice(handleEncoding))
      this._pendingIndexEntry = false
    }

    if (!!this._metaBlock) {
      this._metaBlock.addkey(key)
    }

    this._lastKey = new Slice(key)
    this._numberOfEntries++
    this._dataBlock.add(key, value)

    if (this._dataBlock.currentSizeEstimate() > this._options.blockSize) {
      await this.flush()
    }
  }

  get numEntries(): number {
    return this._numberOfEntries
  }

  get fileSize(): number {
    return this._fileSize
  }

  async flush(): Promise<void> {
    assert(!this._closed)
    if (this._dataBlock.isEmpty()) return
    assert(!this._pendingIndexEntry)
    await this.writeBlock(this._dataBlock, this._pendingHandle)
    this._pendingIndexEntry = true
    if (!!this._metaBlock) {
      this._metaBlock.startBlock(this._offset)
    }
  }

  async writeBlock(block: BlockBuilder, handle: BlockHandle): Promise<void> {
    // File format contains a sequence of blocks where each block has:
    //    block_data: uint8[n]
    //    type: uint8
    //    crc: uint32
    const raw = block.finish()
    const type = CompressionTypes.none // TODO
    await this.writeRawBlock(raw, type, handle)
    this._dataBlock.reset()
  }

  async writeRawBlock(
    blockContent: Slice,
    type: CompressionTypes,
    handle: BlockHandle
  ): Promise<void> {
    handle.offset = this._offset
    handle.size = blockContent.size
    await this.appendFile(blockContent.buffer)
    const trailer = Buffer.alloc(kBlockTrailerSize)
    trailer[0] = type
    const crc32buffer = crc32(
      Buffer.concat([blockContent.buffer, Buffer.from([type])])
    )
    trailer.fill(crc32buffer, 1, 5)
    await this.appendFile(trailer)
    this._offset += blockContent.size + kBlockTrailerSize
  }

  async appendFile(buffer: Buffer): Promise<void> {
    await this._file.appendFile(buffer, { encoding: 'buffer' })
    this._fileSize += buffer.length
  }

  public async close(): Promise<void> {
    if (!this._closed) {
      try {
        await this._file.close()
      } catch (e) {}
      this._closed = true
    }
  }

  public async abandon(): Promise<void> {
    await this.close()
  }

  async finish(): Promise<void> {
    await this.flush()

    const filterBlockHandle = new BlockHandle()
    const metaIndexBlockHandle = new BlockHandle()
    const indexBlockHandle = new BlockHandle()

    if (!!this._metaBlock) {
      await this.writeRawBlock(
        this._metaBlock.finish(),
        CompressionTypes.none,
        filterBlockHandle
      )
    }

    // eslint-disable-next-line
    const metaIndexBlock = new BlockBuilder(this._options)
    metaIndexBlock.blockType = 'metaindexblock'
    if (!!this._metaBlock) {
      let key = 'filter.'
      key += this._options.filterPolicy.name()
      const handleEncoding = filterBlockHandle.buffer
      metaIndexBlock.add(new Slice(key), new Slice(handleEncoding))

      // TODO(postrelease): Add stats and other meta blocks
      await this.writeBlock(metaIndexBlock, metaIndexBlockHandle)
    }

    // Write index block
    if (this._pendingIndexEntry) {
      this._options.comparator.findShortSuccessor(this._lastKey)
      const handleEncoding = this._pendingHandle.buffer
      this._indexBlock.add(this._lastKey, new Slice(handleEncoding))
      this._pendingIndexEntry = false
    }
    await this.writeBlock(this._indexBlock, indexBlockHandle)

    // Write footer
    this._footer.put({
      metaIndexOffset: metaIndexBlockHandle.offset,
      metaIndexSize: metaIndexBlockHandle.size,
      indexOffset: indexBlockHandle.offset,
      indexSize: indexBlockHandle.size,
    })
    await this.appendFile(this._footer.buffer)
    this._offset += this._footer.buffer.length
    await this.close()
  }
}

class BlockBuilder {
  constructor(options: Options) {
    this._options = options
    this._buffer = Buffer.alloc(0)
    this._restarts = [0]
    this._counter = 0
    this._finished = false
    this._lastKey = new Slice()
  }

  public blockType!: string
  private _options: Options
  private _buffer: Buffer
  private _restarts: number[] // First restart point is at offset 0
  private _finished: boolean
  private _counter: number
  private _lastKey: Slice

  get buffer(): Buffer {
    return this._buffer
  }

  public reset(): void {
    this._buffer = Buffer.alloc(0)
    this._restarts = [0]
    this._counter = 0
    this._finished = false
    this._lastKey = new Slice()
  }

  public add(key: Slice, value: Slice): void {
    assert(!this._finished)
    assert(this._counter <= this._options.blockRestartInterval)
    assert(
      this._buffer.length === 0 ||
        this._options.comparator.compare(key, this._lastKey) > 0
    )

    let shared = 0
    if (this._counter < this._options.blockRestartInterval) {
      // See how much sharing to do with previous string
      const minLength = Math.min(this._lastKey.size, key.size)
      while (
        shared < minLength &&
        this._lastKey.buffer[shared] === key.buffer[shared]
      ) {
        shared++
      }
    } else {
      // Restart compression
      this._restarts.push(this._buffer.length)
      this._counter = 0
    }
    const nonShared = key.size - shared
    this._buffer = Buffer.concat([
      this._buffer,
      // Add "<shared><non_shared><value_size>" to buffer_
      encodeFixed32(shared), // shared + nonShared === key.size
      encodeFixed32(nonShared),
      encodeFixed32(value.size),
      // Add string delta to buffer_ followed by value
      key.buffer.slice(shared),
      value.buffer,
    ])

    this._lastKey = new Slice(
      Buffer.concat([
        this._lastKey.buffer.slice(0, shared),
        key.buffer.slice(shared),
      ])
    )
    assert(this._lastKey.buffer.compare(key.buffer) === 0)
  }

  public isEmpty(): boolean {
    return this._buffer.length === 0
  }

  // Add <Buffer restarts.start>...<Buffer restarts[restarts.end]><Buffer restarts count> to tail
  public finish(): Slice {
    // Append restart array
    for (let i = 0; i < this._restarts.length; i++) {
      this._buffer = Buffer.concat([
        this._buffer,
        encodeFixed32(this._restarts[i]),
      ])
    }
    this._buffer = Buffer.concat([
      this._buffer,
      encodeFixed32(this._restarts.length),
    ])
    this._finished = true
    return new Slice(this._buffer)
  }

  public currentSizeEstimate(): number {
    return (
      this._buffer.length + // Raw data buffer
      this._restarts.length * kSizeOfUInt32 + // sizeof(uint32_t), Restart array
      kSizeOfUInt32 // sizeof(uint32_t)  // Restart array length
    )
  }
}

class FilterBlockBuilder {
  static kFilterBaseLg = 11
  static kFilterBase = 1 << FilterBlockBuilder.kFilterBaseLg

  constructor() {
    this._keys = Buffer.alloc(0)
    this._starts = []
    this._result = Buffer.alloc(0)
    this._tempKeys = []
    this._filterOffsets = []
  }

  private _keys: Buffer // Flattened key contents
  private _starts: number[] // Offset in _keys of each key
  private _result: Buffer // Filter data computed so far
  private _tempKeys: Slice[] // policy_->CreateFilter() argument
  private _filterOffsets: number[] // Offset in _result of each filter

  public startBlock(blockOffset: number): void {
    const filterIndex = Math.floor(blockOffset / FilterBlockBuilder.kFilterBase)
    assert(filterIndex >= this._filterOffsets.length)
    while (filterIndex > this._filterOffsets.length) {
      this.generateFilter()
    }
  }

  public generateFilter(): void {
    const numKeys = this._starts.length
    if (numKeys === 0) {
      // Fast path if there are no keys for this filter
      this._filterOffsets.push(this._result.length)
      return
    }

    // Make list of keys from flattened key structure
    this._starts.push(this._keys.length)
    for (let i = 0; i < numKeys; i++) {
      // c++ original
      // const char* base = keys_.data() + start_[i];
      // size_t length = start_[i + 1] - start_[i];
      // tmp_keys_[i] = Slice(base, length);

      // c++ translate directly
      // const base = this._starts[i]
      // const length = this._starts[i + 1] - this._starts[i]
      // this._tempKeys[i] = new Slice(this._keys.slice(base, base + length))

      // c++ translate by meaning
      this._tempKeys[i] = new Slice(
        this._keys.slice(this._starts[i], this._starts[i + 1])
      )
    }

    // Generate filter for current set of keys and append to result_.
    this._filterOffsets.push(this._result.length)
    const filter = new BloomFilter()
    filter.putKeys(this._tempKeys, numKeys)
    this._result = Buffer.concat([this._result, filter.buffer])

    this._keys = Buffer.alloc(0)
    this._tempKeys = []
    this._starts = []
  }

  public addkey(key: Slice): void {
    this._starts.push(this._keys.length)
    this._keys = Buffer.concat([this._keys, key.buffer])
  }

  public finish(): Slice {
    if (this._starts.length > 0) {
      this.generateFilter()
    }

    // Append array of per-filter offsets
    const arrayOffset = this._result.length
    for (let i = 0; i < this._filterOffsets.length; i++) {
      this._result = Buffer.concat([
        this._result,
        encodeFixed32(this._filterOffsets[i]),
      ])
    }

    this._result = Buffer.concat([
      this._result,
      encodeFixed32(arrayOffset),
      Buffer.from([FilterBlockBuilder.kFilterBaseLg]), // Save encoding parameter in result
    ])

    return new Slice(this._result)
  }
}
