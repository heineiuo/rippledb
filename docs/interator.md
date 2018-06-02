```js

function Range(low, high){
  this.low = low;
  this.high = high;
}
Range.prototype[Symbol.iterator] = function(){
  return new RangeIterator(this);
};

function RangeIterator(range){
  this.range = range;
  this.current = this.range.low;
}
RangeIterator.prototype.next = function(){
  let result = {done: this.current > this.range.high, value: this.current};
  this.current++;
  return result;
};

var range = new Range(3, 5);
for (var i of range) {
  console.log(i);
}

```


ReadableStream should be an async iterable #778

https://github.com/tc39/proposal-async-iteration/issues/74
https://github.com/whatwg/streams/issues/778


```js
try {
  for await (const chunk of rs) {
    await somethingThatMightReject(chunk);
  }
} finally {
  try {
    // Might throw if the reader is still locked because we finished
    // successfully without breaking or throwing.
    await rs.cancel();
  } catch {}
}
```

