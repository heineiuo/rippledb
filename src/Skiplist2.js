import assert from 'assert'
import bufferEqual from 'buffer-equal'

const P = 1 / Math.E;

/**
 * 
 * @param {array} left 
 * @param {array} right 
 */
function nodesEqual(left, right) {
  if ((left === undefined) && right) return false;
  if ((right === undefined) && left) return false;
  if (!isEqual(left.key, right.key)) return false;
  if (!isEqual(left.value, right.value)) return false;
  return true;
}


/**
 * 
 * @param {*} a 
 * @param {*} b 
 */
function isEqual(a, b) {
  if (!(Buffer.isBuffer(a) && Buffer.isBuffer(b))) return a === b;
  return bufferEqual(a, b);
}


class SkiplistNode {
  constructor(maxlevel, next, key, value) {
    this.key = key
    this.value = value
    this.maxlevel = maxlevel
    this.levels = new Array(maxlevel + 1)
    this.fill(next)
  }

  fill(next) {
    for (let i = 0; i <= this.maxlevel; i++) {
      this.levels[i] = next
    }
  }

  forEach(cb) {
    for (let i = 0; i <= this.maxlevel; i++) {
      cb(this.levels[i], i)
    }
  }
}


class Skiplist {

  constructor(maxsize) {
    this.maxsize = maxsize || 65535;
    this.maxlevel = Math.round(Math.log(this.maxsize, 2));

    this.level = 0;

    // 开局的时候，tail是NIL， head指向tail
    // [] -------> []
    // [] -------> []
    // [] -------> []
    // [] -------> []
    // [] -------> []
    // head       tail
    this.tail = new SkiplistNode(this.maxlevel);
    this.tail.fill(this.tail)
    this.head = new SkiplistNode(this.maxlevel, this.tail);
  }

  randomLevel() {
    let randomLevel = 0;
    const max = Math.min(this.maxlevel, this.level + 1);
    while ((Math.random() < P) && (randomLevel < max)) {
      randomLevel++;
    }
    return randomLevel;
  }

  findPrev(key, update = []) {
    
    let level = this.maxlevel;
    let prev = this.head
    let current = prev.levels[level]
    // let times = 0
    while (level >= 0) {
      // times ++
      assert(prev.levels.length > level, 'prev level length must bigger then level')

      update[level] = prev
      current = prev.levels[level]

      // 如果当前节点的next节点是this.tail
      //  如果level已经是0，则循环结束，说明插入节点最大，
      //  否则继续向下查找
      // 如果key比下一个节点的key小，则循环结束
      //   如果next节点的key比插入节点小，则查找next节点是否存在
      //   next节点且比key大
      if (current != this.tail && current.key < key) {
        prev = current
        continue;
      }
      level--
    }

    // console.log(`${key} find times: ${times}`)
    
    return prev
  }

  get(key) {
    let prev = this.findPrev(key);
    if (!prev) return null;
    let current = prev.levels[0];
    if (isEqual(current.key, key)) return current.value;
    return null;
  }

  del(key) {
    let update = new Array(this.maxlevel + 1);
    let prev = this.findPrev(key, update);
    if (!prev) return null;
    let node = prev.levels[0];
    if (!isEqual(node.key, key)) return;

    for (let i = 0; i <= node.maxlevel; i++) {
      if (update[i]) {
        update[i].levels[i] = node.levels[i]
      }
    }

  }

  put(key, value) {
    let update = new Array(this.maxlevel + 1)
    let prev = this.findPrev(key, update)
    if (isEqual(prev.key, key)) {
      prev.value = value
    } else {
      const randomLevel = this.randomLevel()
      this.level = Math.max(randomLevel, this.level)
      // console.log(`randomLevel, ${randomLevel}`)
      const node = new SkiplistNode(randomLevel, prev.levels[0], key, value)

      for (let i = 0; i <= randomLevel; i++) {
        if (update[i]) {
          node.levels[i] = update[i].levels[i]
          update[i].levels[i] = node
        }
        // prev.levels[i] = node
      }
    }
  }
}


export default Skiplist