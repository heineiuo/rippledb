# node-level
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
- [x] Log
- [x] LogRecord
- [x] MemTable
- [ ] LRU
- [ ] Comparator
- [ ] Top-level API

## Benchmark

TableBuilder:
```
SSTableBuilder 50000 records: 1260.794ms
```
