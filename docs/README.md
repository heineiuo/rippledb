# Docs


## Top level API

### Database

```ts
constructure (dbpath: string, options:Options = new Options()): Database
```

Create a new database or recover from an exist database.

see [Options](#Options)

### db.ok

```ts
ok():Promise<boolean>
```

Database maybe in recovering state after creation. When db recovering, `get` or `put` method is not aviabile. 
`ok` can help you know when db is ready to `get` or `put` data.


### db.get

```ts
async get(key:string | Buffer, options:ReadOptions = new ReadOptions()):Promise<Buffer>
```

Get record from db. 

see [ReadOptions](#ReadOptions)

### db.put

```ts
async put(key:string | Buffer, value:string | Buffer, options: WriteOptions = new WriteOptions()):Promise<void>
```

see [WriteOptions](#WriteOptions)

### db.del

```ts
del(key:string | Buffer, WriteOptions = new WriteOptions()):Promise<void>
```

see [WriteOptions](#WriteOptions)


### db.batch

```ts
batch(batch:WriteBatch, WriteOptions = new WriteOptions()):Promise<void>
```

see [WriteOptions](#WriteOptions)


### db.iterator()

```ts
async iterator():AsyncIterableIterator<{key: Buffer | string, value: Buffer | string}>
```

### WriteBatch


### Options

Name|Type|Default|Description
-|-|-|-
debug|`boolean`|`false`|-


### ReadOptions
### WriteOptions
