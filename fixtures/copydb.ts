import path from 'path'
import fs from 'fs'

export async function copydb(dbpath1: string, dbpath2: string): Promise<void> {
  const files = await fs.promises.readdir(dbpath1, { withFileTypes: true })
  const filenames = files.reduce((filenames: string[], direct: fs.Dirent) => {
    if (direct.isFile()) {
      if (direct.name !== 'LOCK') filenames.push(direct.name)
    }
    return filenames
  }, [])
  for await (const filename of filenames) {
    await fs.promises.copyFile(
      path.resolve(dbpath1, filename),
      path.resolve(dbpath2, filename)
    )
  }
}
