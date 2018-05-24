import path from 'path'
import fs from 'fs'
import MemTable from './MemTable'
import Log from './Log'

class Database {
  constructor(dbpath) {
    this._log = new Log(dbpath)
    this._mem = new MemTable()
  }

}


export default Database