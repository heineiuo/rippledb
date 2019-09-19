const Skiplist = require('../../dist/Skiplist').default
const Skiplist2 = require('../../dist/Skiplist2').default

function makeAnimalList (Skiplist, method) {
  var list = new Skiplist()
  list[method]('cat', 'Cats are cute.')
  list[method]('wallaby', 'Wallabies bounce.')
  list[method]('cat', 'Cats are cute.')
  list[method]('ca44t', 'Cats are cute.')
  list[method]('dog4', 'Dogs are loyal.')
  list[method]('aar4d2vark', 'Aardvarks are long-nosed.')
  list[method]('wal2laby', 'Wallabies bounce.')
  list[method]('ca1t', 'Cats are cute.')
  list[method]('walla3by', 'Wallabies bounce.')
  list[method]('carac2al', 'Caracals are pretty.')
  list[method]('carac1al', 'Caracals are pretty.')
  list[method]('caracal', 'Caracals are pretty.')
  list[method]('car1acal', 'Caracals are pretty.')
  list[method]('leopard', 'Leopards are spotted.')
  list[method]('leo2pard', 'Leopards are spotted.')
  list[method]('leop3ard', 'Leopards are spotted.')
  list[method]('carac45al', 'Caracals are pretty.')
  list[method]('pango6lin', 'Pangolins trundle.')
  list[method]('ayeay7e', 'Ayeaye are weird drinkers.')

  return list
}

; (() => {
  let i = 0

  i = 0
  while (i < 20000) {
    i++
    makeAnimalList(Skiplist, 'insert')
    makeAnimalList(Skiplist2, 'put')
  }

  i = 0
  console.time('skiplist')
  while (i < 1000) {
    i++
    makeAnimalList(Skiplist, 'insert')
  }
  console.timeEnd('skiplist')

  i = 0
  console.time('skiplist2')
  while (i < 1000) {
    i++
    makeAnimalList(Skiplist2, 'put')
  }
  console.timeEnd('skiplist2')
})()
