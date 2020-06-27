# Repair

## API

```ts

class DBRepairer {
  _dbname:string
  _env:Env
  _icmp:InternalCompareter
  _ipolicy: InternalPolicy
  _options: Options
  _ownsInfoLog: InfoLog
  _ownsCache: Cache
  _nextFileNumber: FileNumber
  _tableCache: TableCache

  async run(): Promise<void> {
    await this.findFiles()
    await this.convertLogFilesToTables()
    await this.extractMetaData()
    await this.writeDescriptor()
    await this.log()
  }
}

const repairer = new DBRepairer()
await repairer.ok()

```

## Mechanism

If `Manifest` file or `SSTable` file was broken, `Database` cannot recovery success. So 
we need use `DBRepairer` to repair db files.

First, `DBRepairer` will find all files in `dbpath`. 
If `.log` file is found, convert it to SSTable files (Do not store in memory).

Then, read all SSTable files and extract their metadata to 
a new `Manifest` file.

Drop the damaged records when iterator `SSTable` files.

Rename Manifest to `MANIFEST-000001` and write to `CURRENT` file

## Questions
