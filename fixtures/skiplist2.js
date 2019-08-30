const Skiplist = require('../dist/Skiplist2').default

function makeAnimalList () {
  var list = new Skiplist()
  list.put('cat', 'Cats are cute.')
  list.put('dog', 'Dogs are loyal.')
  list.put('aardvark', 'Aardvarks are long-nosed.')
  list.put('wallaby', 'Wallabies bounce.')
  list.put('caracal', 'Caracals are pretty.')
  list.put('leopard', 'Leopards are spotted.')
  list.put('pangolin', 'Pangolins trundle.')
  list.put('ayeaye', 'Ayeaye are weird drinkers.')

  return list
}

; (async () => {
  console.time('make and match')

  var list = new Skiplist()

  list.put(Buffer.from('key1'), Buffer.from('Cats are cute.'))
  list.put(Buffer.from('cat'), Buffer.from('hello kitty'))
  list.get(Buffer.from('key1'))

  console.timeEnd('make and match')

  console.log(list.get(Buffer.from('cat')))

  list.del(Buffer.from('cat'))

  console.log(list.get(Buffer.from('key1')))
  console.log(list.get(Buffer.from('cat')))
})()

module.exports = {
  makeAnimalList
}
