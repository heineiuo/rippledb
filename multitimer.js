async function loop(name, store) {
  while (true) {
    if (store.foo > 10) {
      break
    }
    let promise = new Promise(resolve =>
      setTimeout(resolve, Math.random() * 100)
    )
    await promise
    if (store.bar > 100) {
      break
    }
    console.log(`${name}: foo=${store.foo++} bar=${store.bar++}`)
  }
}

function main() {
  function getStore() {
    return {
      foo: 0,
      bar: 0,
    }
  }

  const store = getStore()

  let i = 0
  while (i < 10) {
    setImmediate(() => {
      loop(`looper${i}`, store)
    })
    i++
  }
}

main()
// 问题：最后打印的是什么，为什么？
