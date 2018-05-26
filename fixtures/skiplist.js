const Skiplist = require('../dist/Skiplist').default


function makeAnimalList() {
  var list = new Skiplist(30);
  list.insert('cat', 'Cats are cute.');
  list.insert('dog', 'Dogs are loyal.');
  list.insert('aardvark', 'Aardvarks are long-nosed.');
  list.insert('wallaby', 'Wallabies bounce.');
  list.insert('caracal', 'Caracals are pretty.');
  list.insert('leopard', 'Leopards are spotted.');
  list.insert('pangolin', 'Pangolins trundle.');
  list.insert('ayeaye', 'Ayeaye are weird drinkers.');

  return list;
}

function makeBufList() {

  var list = new Skiplist(2);
  list.insert(Buffer.from('key1'), 'Cats are cute.');

  return list
}

; (async () => {

  const list = makeBufList()

  console.log(list.match('key1'))

  console.log(list.match(Buffer.from('key1')))


})();

module.exports = {
  makeAnimalList
}