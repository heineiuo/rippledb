const path = require('path');
const { promises: fs } = require('fs');
const Log = require('../dist/Log').default;
const dbpath = require('./dbpath');

const log = new Log(dbpath);

(async () => {
  console.time('log read');

  let record = log.parseRecord(await fs.readFile(log._logPath));
  console.timeEnd('log read');

  console.log({
    key: record.key.toString(),
    value: JSON.parse(record.value.toString())
  })
})();

