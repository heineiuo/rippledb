export class YallistNode<T = unknown> {
  constructor(
    value: T,
    prev: null | YallistNode<T>,
    next: null | YallistNode<T>,
    list: Yallist<T>,
  ) {
    this.list = list;
    this.value = value;

    if (prev) {
      prev.next = this;
      this.prev = prev;
    } else {
      this.prev = null;
    }

    if (next) {
      next.prev = this;
      this.next = next;
    } else {
      this.next = null;
    }
  }

  value: T;
  list: Yallist<T> | null;
  prev: YallistNode<T> | null;
  next: YallistNode<T> | null;
}

export class Yallist<T = unknown> {
  constructor() {
    this.tail = null;
    this.head = null;
  }

  length = 0;

  tail: null | YallistNode<T>;
  head: null | YallistNode<T>;

  push(item: T): number {
    this.tail = new YallistNode<T>(item, this.tail, null, this);
    if (!this.head) {
      this.head = this.tail;
    }
    this.length++;

    return this.length;
  }

  unshift(item: T): number {
    this.head = new YallistNode(item, null, this.head, this);
    if (!this.tail) {
      this.tail = this.head;
    }
    this.length++;

    return this.length;
  }

  unshiftNode(node: YallistNode<T>): void {
    if (node === this.head) {
      return;
    }

    if (node.list) {
      node.list.removeNode(node);
    }

    const head = this.head;
    node.list = this;
    node.next = head;
    if (head) {
      head.prev = node;
    }

    this.head = node;
    if (!this.tail) {
      this.tail = node;
    }
    this.length++;
  }

  removeNode(node: YallistNode<T>): YallistNode<T> | null {
    if (node.list !== this) {
      throw new Error("removing node which does not belong to this list");
    }

    const next = node.next;
    const prev = node.prev;

    if (next) {
      next.prev = prev;
    }

    if (prev) {
      prev.next = next;
    }

    if (node === this.head) {
      this.head = next;
    }
    if (node === this.tail) {
      this.tail = prev;
    }

    node.list.length--;
    node.next = null;
    node.prev = null;
    node.list = null;

    return next;
  }

  forEach(callbackFn: (value: T, index: number, list: this) => void): void {
    for (let walker = this.head, i = 0; walker !== null; i++) {
      callbackFn(walker.value, i, this);
      walker = walker.next;
    }
  }

  map(callbackFn: (value: T, list: this) => T): Yallist {
    const res = new Yallist();
    for (let walker = this.head; walker !== null; ) {
      res.push(callbackFn(walker.value, this));
      walker = walker.next;
    }
    return res;
  }

  toArray(): T[] {
    const arr = new Array(this.length);
    for (let i = 0, walker = this.head; walker !== null; i++) {
      arr[i] = walker.value;
      walker = walker.next;
    }
    return arr;
  }
}
