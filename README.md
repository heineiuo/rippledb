# node-level


<p>
  <a href="https://github.com/heineiuo/node-level/actions"><img alt="GitHub Actions status" src="https://github.com/heineiuo/node-level/workflows/Node%20CI/badge.svg"></a>

[![Coverage Status](https://coveralls.io/repos/github/heineiuo/node-level/badge.svg)](https://coveralls.io/github/heineiuo/node-level)

</p>
A pure node.js implementation of LSM(log structured merge tree) based storage engine(inspired by leveldb).

## Roadmap
- [x] SSTableFooter
- [x] SSTableRecord
- [x] SSTableBaseBlock
- [x] SSTableDataBlock
- [x] SSTableIndexBlock
- [x] SSTableMetaBlock
- [x] SSTableMetaIndexBlock
- [x] SSTableBuilder
- [x] SSTable
- [x] BloomFilter
- [x] LogWriter
- [x] LogReader
- [x] LogRecord
- [x] MemTable
- [x] WriteBatch
- [x] ManifestRecord
- [x] VersionEdit
- [x] VersionBuilder
- [ ] Version
- [ ] VersionSet
- [ ] LRU
- [ ] Compaction
- [ ] Top-level API

## Benchmark

TableBuilder:
```
SSTableBuilder 50000 records: 1260.794ms
```
