import path from 'path'
import rimraf from 'rimraf'

export function createDir() {
  return path.resolve(
    __dirname,
    `../.db/${Math.random()
      .toString()
      .substr(2)}`
  )
}

export function cleanup(dbpath) {
  rimraf.sync(dbpath)
}
