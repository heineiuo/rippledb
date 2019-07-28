// import { Buffer } from 'buffer'
import SSTableBlock from './SSTableBlock'

export default class TableDataBlock extends SSTableBlock {
  blockType = 'TableDataBlock'
}
