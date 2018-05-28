import path from 'path'
import fs from 'fs'
import Skiplist from './Skiplist2'

class MemTable {
  constructor() {
    this._list = new Skiplist()
  }
  
  
}

export default MemTable