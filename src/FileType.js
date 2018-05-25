import Enum from 'enum'


const FileType = new Enum([
  'kLogFile',
  'kDBLockFile',
  'kTableFile',
  'kDescriptorFile',
  'kCurrentFile',
  'kTempFile',
  'kInfoLogFile' // Either the current one, or an old one
])