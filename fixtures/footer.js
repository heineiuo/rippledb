const fs = require('fs').promises
const path = require('path')
const Footer = require('../build/SSTableFooter').default

async function write () {
  try {
    const footer = new Footer()
    footer.put({
      metaIndexOffset: 100,
      metaIndexSize: 100123,
      indexOffset: 123123,
      indexSize: 20123
    })
    const footerPath = path.resolve(__dirname, '../.db/footer')
    await fs.writeFile(footerPath, footer.buffer)
  } catch (e) {
    console.log(e)
  }
}

async function read () {
  try {
    const footerPath = path.resolve(__dirname, '../.db/footer')
    const footer = new Footer(await fs.readFile(footerPath))
    console.log(footer.get())
  } catch (e) {
    console.log(e)
  }
}

async function main () {
  await write()
  await read()
}

main()
