const Skiplist = require('../dist/Skiplist2').default


function makeAnimalList() {
  var list = new Skiplist();
  list.put('cat', 'Cats are cute.');
  list.put('dog', 'Dogs are loyal.');
  list.put('aardvark', 'Aardvarks are long-nosed.');
  list.put('wallaby', 'Wallabies bounce.');
  list.put('caracal', 'Caracals are pretty.');
  list.put('leopard', 'Leopards are spotted.');
  list.put('pangolin', 'Pangolins trundle.');
  list.put('ayeaye', 'Ayeaye are weird drinkers.');

  return list;
}

function makeBufList() {

  var list = new Skiplist(2);
  list.put(Buffer.from('key1'), 'Cats are cute.');

  return list
}

; (async () => {

  console.time('make and match')
  const list = makeBufList()
  list.put('cat', 'hello kitty')
  list.get('key1')
  console.timeEnd('make and match')
  
  console.log(list.get('cat'))

  console.log(list.get(Buffer.from('key1')))
  
  list.del('cat')
  console.log(list.get('cat'))


})();

module.exports = {
  makeAnimalList
}