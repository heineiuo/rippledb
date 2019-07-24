const fs = require('fs').promises
const path = require('path')
const Footer = require('../build/SSTableFooter').default

async function write () {
  try {
    const footerPath = path.resolve(__dirname, '../.db/footer')
    const footer = new Footer({
      metaIndexOffset: 100,
      metaIndexSize: 100123,
      indexOffset: 123123,
      indexSize: 20123
    })
    await fs.writeFile(footerPath, footer.toBuffer())
  } catch (e) {
    console.log(e)
  }
}

async function read () {
  try {
    const footerPath = path.resolve(__dirname, '../.db/footer')
    const footer = Footer.fromBuffer(await fs.readFile(footerPath))
    console.log(footer)
  } catch (e) {
    console.log(e)
  }
}

async function main () {
  await write()
  await read()
}

main()
