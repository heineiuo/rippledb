
const demand = require('must')
const crypto = require('crypto')
const Skiplist = require('../dist/Skiplist')

const { makeAnimalList } = require('../fixtures/skiplist')

describe('Skiplist', function () {
  describe('#insert()', function () {
    it('adds an item to the skiplist', function () {
      var list = new Skiplist(10)
      list.length().must.equal(0)
      list.insert('key', 'value')
      list.length().must.equal(1)

      var result = list.match('key')
      result.must.equal('value')
    })

    it('updates an existing item', function () {
      var list = new Skiplist(10)
      list.length().must.equal(0)
      list.insert('key', 'value')
      list.length().must.equal(1)

      list.insert('key', 'another value')
      list.length().must.equal(1)

      var result = list.match('key')
      result.must.equal('another value')
    })

    it('zero cannot be a key', function () {
      function willThrow () {
        var list = new Skiplist(10)
        list.insert(0, 'zero, my hero')
      }
      willThrow.must.throw(Error)
    })

    it('can handle a few thousand items', function () {
      this.timeout(10000)
      var list = new Skiplist(6000)
      var buf1, buf2

      for (var i = 0; i < 5000; i++) {
        buf1 = crypto.pseudoRandomBytes(8).toString('hex')
        buf2 = crypto.pseudoRandomBytes(24).toString('hex')
        list.insert(buf1, buf2)
      }

      list.length().must.equal(5000)
      var results = list.find('f')
      results.must.be.an.array()
    })
  })

  describe('#find()', function () {
    it('returns an array containing the entire contents of the list', function () {
      var list = makeAnimalList()
      var results = list.find()
      results.must.be.an.array()
      results.length.must.equal(8)
    })

    it('emits in sorted order', function () {
      var list = makeAnimalList()
      var results = list.find()
      results[0][0].must.equal('aardvark')
      results[3][0].must.equal('cat')
      results[7][0].must.equal('wallaby')
    })

    it('returns the result of a search reversed', function () {
      var list = makeAnimalList()
      var results = list.find(null, true)
      results.must.be.an.array()
      results.length.must.equal(8)
      results[7][0].must.equal('aardvark')
      results[4][0].must.equal('cat')
      results[0][0].must.equal('wallaby')
    })

    it('with a parameter, it emits items greater than the passed-in key', function () {
      var list = makeAnimalList()
      var results = list.find('dog')
      results.must.exist()
      results.must.be.an.array()
      results.length.must.equal(4)
    })
  })

  describe('#findWithCount()', function () {
    it('returns at most the desired number of matches', function () {
      var list = makeAnimalList()
      var results = list.findWithCount('dog', 2)
      results.must.exist()
      results.must.be.an.array()
      results.length.must.equal(2)
    })

    it('works in reverse', function () {
      var list = makeAnimalList()
      var results = list.findWithCount('wallaby', 2)
      results.must.exist()
      results.must.be.an.array()
      results.length.must.equal(1)
    })
  })

  describe('#match()', function () {
    it('returns nodes with keys matching the input', function () {
      var list = makeAnimalList()
      var result = list.match('cat')
      result.must.exist()
      result.must.be.a.string()
      result.must.equal('Cats are cute.')
    })

    it('returns null when no match is found', function () {
      var list = makeAnimalList()
      var result = list.match('caz')
      demand(result).be.null()
    })
  })

  describe('#remove()', function () {
    it('removes items from the structure', function () {
      var list = makeAnimalList()
      var result = list.match('cat')
      result.must.exist()
      list.remove('cat').must.equal(true)
      demand(list.match('cat')).be.null()
      list.length().must.equal(7)
    })

    it('returns false when asked to remove an item not in the list', function () {
      var list = makeAnimalList()
      list.remove('coati').must.be.false()
    })

    it('can delete all entries in the list', function () {
      var list = makeAnimalList()
      var items = list.find()
      for (var i = 0; i < items.length; i++) { list.remove(items[i][0])}

      list.length().must.equal(0)
    })
  })

  describe('some random churn', function () {
    it('can handle random adds and deletes without barfing', function () {
      this.timeout(30000)

      var list = new Skiplist(60000)

      function addRandom () {
        var buf1 = crypto.pseudoRandomBytes(8).toString('hex')
        var buf2 = crypto.pseudoRandomBytes(24).toString('hex')
        list.insert(buf1, buf2)
      }

      function removeRandom () {
        var buf1 = crypto.pseudoRandomBytes(8).toString('hex')
        var results = list.find(buf1)
        if (!results.length) { return}
        list.remove(results[0][0])
      }

      for (var i = 0; i < 10000; i++) {
        var coinflip = Math.random()
        if (coinflip > 0.33) { addRandom()} else { removeRandom()}
      }

      var results = list.find('f')
      results.must.be.an.array()
    })

    it('can make a lot of animal lists', function () {
      for (var i = 0; i < 1000; i++) {
        makeAnimalList()
      }
    })
  })
})
