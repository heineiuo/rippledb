import path from 'path'
import fs from 'fs'
import MemTable from './MemTable'
import Log from './Log'
import SequenceNumber from './SequenceNumber'

class Database {
  constructor(dbpath) {
    this._log = new Log(dbpath)
    this._mem = new MemTable()
    this.recovery()
  }

  recovery() {
    this._log.readLogRecord(0)
  }

  _viewLog = () => {

  }

}


export default Database