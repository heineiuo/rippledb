const fs = require('fs')
const path = require('path')
const Footer = require('../build/SSTableFooter').default

async function write () {
  try {
    const footerPath = path.resolve(__dirname, '../.db/footer')
    const footer = new Footer()

    footer.metaIndexOffset = 100
    footer.metaIndexSize = 100123
    footer.indexSize = 20123
    footer.indexSize = 100124

    await fs.promises.writeFile(footerPath, footer.encode())
  } catch (e) {
    console.log(e)
  }
}

async function read () {
  try {
    const footerPath = path.resolve(__dirname, '../.db/footer')

    const footer = Footer.fromBuffer(await fs.promises.readFile(footerPath))
    console.log(footer)
  } catch (e) {
    console.log(e)
  }
}

read()
