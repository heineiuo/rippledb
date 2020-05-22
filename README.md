# rippledb


<p>
  <a href="https://github.com/heineiuo/rippledb/actions"><img style="max-width:100%" alt="GitHub Actions status" src="https://github.com/heineiuo/rippledb/workflows/Node%20CI/badge.svg"></a>
  <a href="https://coveralls.io/github/heineiuo/rippledb"><img style="max-width:100%" alt="Coverage status" src="https://coveralls.io/repos/github/heineiuo/rippledb/badge.svg"></a>
  <a href="https://www.npmjs.com/package/rippledb"><img style="max-width:100%" alt="npm version" src="https://img.shields.io/npm/v/rippledb.svg?style=flat"></a>
  <a href="https://gitter.im/heineiuo/rippledb?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge"><img style="max-width:100%" alt="Join the chat at https://gitter.im/heineiuo/rippledb" src="https://badges.gitter.im/heineiuo/rippledb.svg"></a>
</p>

A pure node.js implementation of LSM(log structured merge tree) based storage engine(inspired by leveldb).

## Get started

Use in JavaScript or TypeScript:

```js
const path = require('path')
const { Database } = require('rippledb') // install from npm

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
- [x] TableCache
- [x] LogWriter
- [x] LogReader
- [x] WriteBatch
- [x] MemTable
- [x] Database Recovery
- [x] Version Manager
- [x] Compaction
- [x] Top-level API (put, get, del, batch, iterator, compactRange, ok)
- [ ] Repair
- [x] Destroy

## Benchmark

```log
environment : GitHub Action
key         : 16 bytes
value       : 100 bytes
total       : 10000
runners     : 10 
fillrandom  : 823.87 ms total; 82.39 us/op
```

## License

[MIT License](./LICENSE)
