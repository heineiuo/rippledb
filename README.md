# [Rippledb](https://rippledb.github.io/) &middot;  <a href="https://github.com/heineiuo/rippledb/actions"><img style="max-width:100%" alt="GitHub Actions status" src="https://github.com/heineiuo/rippledb/workflows/Node%20CI/badge.svg"></a>  <a href="https://coveralls.io/github/heineiuo/rippledb"><img style="max-width:100%" alt="Coverage status" src="https://coveralls.io/repos/github/heineiuo/rippledb/badge.svg"></a>  <a href="https://www.npmjs.com/package/rippledb"><img style="max-width:100%" alt="npm version" src="https://img.shields.io/npm/v/rippledb.svg?style=flat"></a>  <a href="https://gitter.im/heineiuo/rippledb?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge"><img style="max-width:100%" alt="Join the chat at https://gitter.im/heineiuo/rippledb" src="https://badges.gitter.im/heineiuo/rippledb.svg"></a>


Embeddable key-value database engine in pure TypeScript, based on LSM-Tree, Inspired by LevelDB.

## Get started

Use in JavaScript or TypeScript:

```ts
import path from 'path'
import { Database } from 'rippledb'

async function main(){
  const db = new Database(path.resolve(__dirname, './db'))
  await db.put('foo', 'bar')
  console.log(
    new TextDecorder().decode(await db.get('foo'))
  ) // 'bar'
}

main()
```


For more details and examples, see [Documention](https://rippledb.github.io/docs/new-database).

## Roadmap

[x] Release 1.0 (2020-07-07)
[ ] Support [Deno](https://deno.land) (2020-9-1)

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
