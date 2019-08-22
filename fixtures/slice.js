const Slice = require('../build/Slice').default

function main () {
  const slice = new Slice()
  addProperty(slice, 'x', 'y')
  addProperty(slice, 'x1', 'y1')
  console.log(slice)

  const slice2 = new Slice(slice)
  console.log(slice2)
  addProperty(slice2, 'x3', 'y3')
  console.log(slice)
}

function addProperty(slice, propertyName, value){
  slice[propertyName] = value
}

main()