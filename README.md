# node-level

[![Join the chat at https://gitter.im/heineiuo/node-level](https://badges.gitter.im/heineiuo/node-level.svg)](https://gitter.im/heineiuo/node-level?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)


<p>
  <a href="https://github.com/heineiuo/node-level/actions"><img style="max-width:100%" alt="GitHub Actions status" src="https://github.com/heineiuo/node-level/workflows/Node%20CI/badge.svg"></a>
  <a href="https://coveralls.io/github/heineiuo/node-level"><img style="max-width:100%" alt="Coverage status" src="https://coveralls.io/repos/github/heineiuo/node-level/badge.svg"></a>

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
