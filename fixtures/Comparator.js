const Comparator = require('../build/Comparator').default

const comparator = new Comparator()

console.log('findShortestSeparator keyabc, keyxyz: ', String(comparator.findShortestSeparator('keyabc', 'keyxyz')))
