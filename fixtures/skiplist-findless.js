const Skiplist = require('../dist/Skiplist').default

; (() => {

  var list = new Skiplist(30);
  console.log(list._findLess(list._update.slice(0), 'cat'))

  list.insert('cat2', 'Cats are cute.');

  console.log('------head-------')
  console.log(list.head)
  console.log('------level------')

  console.log(list.level)
  console.log('------findLess cat1-------')

  console.log(list._findLess(list._update.slice(0), 'cat1'))
})()