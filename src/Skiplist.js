import assert from 'assert'

/**
 * 
 * @param {number} level 
 * @param {*} key 
 * @param {*} value 
 */
function makeNode(level, key, value) {
  const node = new Array(4 + level);
  node[0] = key;
  node[1] = value;
  return node;
}

/**
 * 
 * @param {array} left 
 * @param {array} right 
 */
function nodesEqual(left, right) {
  if ((left === undefined) && right) return false;
  if ((right === undefined) && left) return false;
  if (left[0] !== right[0]) return false;
  if (left[1] !== right[1]) return false;
  if (left[2] !== right[2]) return false;
  if (left[3] !== right[3]) return false;
  return true;
}

const P = 1 / Math.E;
const NIL = makeNode(-1);

class Skiplist {
  constructor() {
    this.maxsize = maxsize || 65535; // Uint64
    this.maxlevel = Math.round(Math.log(this.maxsize, 2));

    this.level = 0;
    this.head = makeNode(this.maxlevel);
    this.tail = NIL;
    for (let i = 0; i < this.maxlevel; i++) {
      this.head[i + 3] = NIL;
      this._update = new Array(this.maxlevel + 1);
    }

    for (let i = 0; i < this._update.length; i++) {
      this._update[i] = this.head;
    }
  }

  _randomLevel() {
    let lvl = 0;
    const max = Math.min(this.maxlevel, this.level + 1);
    while ((Math.random() < P) && (lvl < max)) {
      lvl++;
    }
    return lvl;
  }

  find(search, reverse) {
    let node = reverse ? this.tail : this.head[3];
    const idx = reverse ? 2 : 3;
    const results = [];

    if (search) {
      const update = this._update.slice(0);
      const found = this._findLess(update, search);
      if (!nodesEqual(found[3], NIL)) {
        node = found[3];
      }
    }
    while (node[0]) {
      results.push([node[0], node[1]]);
      node = node[idx];
    }
    return results;
  }

  findWithCount(search, maxResultsToReturn, reverse) {
    let node = reverse ? this.tail : this.head[3];
    const idx = reverse ? 2 : 3;
    const results = [];

    if (search) {
      const update = this._update.slice(0);
      const found = this._findLess(update, search);
      if (!nodesEqual(found[3], NIL))
        node = found[3];
    }
    while (node[0] && (results.length < maxResultsToReturn)) {
      results.push([node[0], node[1]]);
      node = node[idx];
    }
    return results;
  };

  length() {
    // more for my curiosity
    let node = this.head[3];
    let count = 0;
    while (node[0]) {
      count++;
      node = node[3];
    }
    return count;
  };

  _findLess(update, search) {
    let node = this.head;
    for (let i = this.level; i >= 0; i--) {
      let key = node[3 + i][0];
      while (key && (key < search)) {
        node = node[3 + i];
        key = node[3 + i] ? node[3 + i][0] : null;
      }
      update[i] = node;
    }
    return node;
  };

  insert(key, value) {
    assert(key);
    const update = this._update.slice(0);
    let node = this._findLess(update, key);
    const prev = node;
    node = node[3];
    if (node[0] === key) {
      node[1] = value;
    } else {
      const lvl = this._randomLevel();
      this.level = Math.max(this.level, lvl);
      node = makeNode(lvl, key, value);
      node[2] = prev;
      for (let i = 0; i <= this.level; i++) {
        node[3 + i] = update[i][3 + i];
        update[i][3 + i] = node;
      }
      if (nodesEqual(node[3], NIL)) {
        this.tail = node;
      } else {
        node[3][2] = node;
      }
    }
  };

  remove(key) {
    const update = this._update.slice(0);
    let node = this._findLess(update, key);
    node = node[3];

    if (node[0] === key) {
      node[3][2] = update[0];
      for (let i = 0; i <= this.level; i++) {
        if (!nodesEqual(update[i][3 + i], node)) {
          break;
        }
        update[i][3 + i] = node[3 + i];
      }

      while ((this.level > 1) && (this.head[3 + this.level].key !== null)) {
        this.level--;
      }

      if (nodesEqual(this.tail, node)) {
        this.tail = node[2];
      }

      return true;
    }

    return false; // just to make it explicit
  };

  match(search) {
    let node = this.head;
    for (let i = this.level; i >= 0; i--) {
      let key = node[3 + i][0];
      while (key && (key < search)) {
        node = node[3 + i];
        key = node[3 + i] ? node[3 + i][0] : null;
      }
    }
    node = node[3];
    if (node[0] === search) {
      return node[1];
    }

    return null;
  };
}


export default Skiplist
