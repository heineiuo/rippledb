class Database {
  constructor () {
    this.recovery()
  }

  async recovery () {
    this._ok = false
    await new Promise((resolve) => setTimeout(resolve, 1000 * Math.random()))
    this._ok = true
  }

  async ok () {
    if (this._ok) return true
    let limit = 5
    let i = 0
    while (i < limit) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      if (this._ok) return true
      i++
    }
    throw new Error('Database is busy.')
  }

  async get () {
    await this.ok()
    return Math.random()
  }
}

async function main () {
  try {
    const db = new Database()
    console.log(await db.get())
  } catch (e) {
    console.log(e)
    process.exit(1)
  }
}

main()
