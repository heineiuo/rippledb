class SequenceNumber {
  constructor() {
    this._value = 0
  }

  increase(){
    this._value ++
  }

  get value() {
    this._value++
    return this._value
  }
}

export default new SequenceNumber()