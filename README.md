# node-level


<p>
  <a href="https://github.com/heineiuo/node-level/actions"><img style="max-width:100%" alt="GitHub Actions status" src="https://github.com/heineiuo/node-level/workflows/Node%20CI/badge.svg"></a>
  <a href="https://coveralls.io/github/heineiuo/node-level"><img style="max-width:100%" alt="Coverage status" src="https://coveralls.io/repos/github/heineiuo/node-level/badge.svg"></a>
  <a href="https://www.npmjs.com/package/node-level"><img style="max-width:100%" alt="npm version" src="https://img.shields.io/npm/v/node-level.svg?style=flat"></a>
  <a href="https://gitter.im/heineiuo/node-level?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge"><img style="max-width:100%" alt="Join the chat at https://gitter.im/heineiuo/node-level" src="https://badges.gitter.im/heineiuo/node-level.svg"></a>
</p>

A pure node.js implementation of LSM(log structured merge tree) based storage engine(inspired by leveldb).

## Get started

Use in JavaScript or TypeScript:

```js
const path = require('path')
const { Database } = require('node-level') // install from npm

async function main(){
  const db = new Database(path.resolve(__dirname, './db'))
  await db.put('foo', 'bar')
  console.log(
    (await db.get('foo')).toString()
  ) // 'bar'
}

main()
```


For more details, see [documention](./docs)


## Roadmap
- [x] TableBuilder
- [x] TableReader
- [ ] TableCache
- [x] LogWriter
- [x] LogReader
- [x] WriteBatch
- [x] MemTable
- [x] Database Recovery
- [x] Version Manager
- [x] Compaction
- [x] Top-level API (put, get, del, compactRange, ok)
- [ ] Top-level API (Iterator)

## Benchmark

TableBuilder:
```
SSTableBuilder 50000 records: 1260.794ms
```
