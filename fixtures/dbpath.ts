import path from 'path'
import rimraf from 'rimraf'

export function createDir(): string {
  return path.resolve(
    __dirname,
    `../.db/${Date.now()}_${Math.random()
      .toString()
      .substr(2)}`
  )
}

export function cleanup(dbpath: string): void {
  rimraf.sync(dbpath)
}
