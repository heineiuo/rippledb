const path = require('path')
const rimraf = require('rimraf')

module.exports.createDir = function() {
  return path.resolve(
    __dirname,
    `../.db/${Math.random()
      .toString()
      .substr(2)}`
  )
}

module.exports.cleanup = function cleanup(dbpath) {
  rimraf.sync(dbpath)
}
