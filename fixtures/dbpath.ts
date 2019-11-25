import path from 'path'
import rimraf from 'rimraf'
import fs from 'fs'

export function createDir(name?: string): string {
  const name1 =
    name ||
    `${Date.now()}_${Math.random()
      .toString()
      .substr(2)}`
  const dir = path.resolve(__dirname, `../.db/${name1}`)

  fs.mkdirSync(dir, { recursive: true })

  return dir
}

export function cleanup(dbpath: string): void {
  rimraf.sync(dbpath)
}
