# node-level


<p>
  <a href="https://github.com/heineiuo/node-level/actions"><img style="max-width:100%" alt="GitHub Actions status" src="https://github.com/heineiuo/node-level/workflows/Node%20CI/badge.svg"></a>
  <a href="https://coveralls.io/github/heineiuo/node-level"><img style="max-width:100%" alt="Coverage status" src="https://coveralls.io/repos/github/heineiuo/node-level/badge.svg"></a>
  <a href="https://gitter.im/heineiuo/node-level?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge"><img style="max-width:100%" alt="Join the chat at https://gitter.im/heineiuo/node-level" src="https://badges.gitter.im/heineiuo/node-level.svg"></a>
</p>

A pure node.js implementation of LSM(log structured merge tree) based storage engine(inspired by leveldb).

## Get started

Install from npm:

```sh
yarn add node-level
```

Use in JavaScript or TypeScript:

```js
const path = require('path')
const { Database } = require('node-level')

async function main(){
  const db = new Database(path.resolve(__dirname, './db'))
  await db.put({}, 'foo', 'bar')
  console.log(
    (await db.get({}, 'foo')).toString()
  ) // 'bar'
}

main()
```


For more details, see [documention](./docs)


## Roadmap
- [x] TableBuilder
- [x] TableReader
- [x] LogWriter
- [x] LogReader
- [x] MemTable
- [x] WriteBatch
- [x] Version Manager
- [x] Compaction
- [x] Top-level API
- [ ] Database Recovery
- [ ] TableCache

## Benchmark

TableBuilder:
```
SSTableBuilder 50000 records: 1260.794ms
```
