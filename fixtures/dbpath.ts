import path from 'path'
import rimraf from 'rimraf'
import fs from 'fs'

export function createDir(): string {
  const dir = path.resolve(
    __dirname,
    `../.db/${Date.now()}_${Math.random()
      .toString()
      .substr(2)}`
  )

  fs.mkdirSync(dir, { recursive: true })

  return dir
}

export function cleanup(dbpath: string): void {
  rimraf.sync(dbpath)
}
