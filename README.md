# node-level


<p align="left">
  <a href="https://github.com/heineiuo/node-level"><img alt="GitHub Actions status" src="https://github.com/heineiuo/node-level/workflows/Node%20CI/badge.svg"></a>
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
- [ ] ManifestRecord
- [ ] Manifest
- [ ] LRU
- [ ] Compaction
- [ ] Top-level API

## Benchmark

TableBuilder:
```
SSTableBuilder 50000 records: 1260.794ms
```
