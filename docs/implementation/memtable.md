# memtable

## skiplist

1. 为什么要用skiplist？

skiplist相比数组，空间上有优势，相比链表，在速度上有优势。相比速度和空间上优势均等的
红黑树，在实现难度上有优势。

2. 如何实现skiplist？

http://dsqiu.iteye.com/blog/1705530

设置一个最大层数

根据最大层数创建head，head里面保存每一层的第一个node，每个node都指向右指向NIL，向下指向上一级节点

插入节点的时候，先获取一个随机层数，再和head里该层的第一个节点比较，如果：

相等，则替换值
否则比较同一层右边的值，最终插入到某个位置，同时向下面的层级插入


获取节点的时候，从head里最大level的node开始查找，如果：

相等则返回
否则跟右边的值比较，如果比右边的大继续向右边查找，否则向下查找，直到找到节点或未找到节点。



## memtable


memtable用到了`arena`做内存管理，包含了`ApproximateMemoryUsage`，实际上nodejs里不需要，内存管理交给V8.

将SequenceNumber和ValueType 以及消息编码成一个字符串，存放在buf数组中，然后调用table.Insert(buf)插入数据。

![memtable buf](./images/3.png)<sup>[[1]](#ref1)</sup>


### key

>所以总结下如下:

>最短的为`internalkey`，就是`userkey`+`sequence`+`type`组成
>接下来是`lookupkey`,由`internalkey`的长度+`internalkey`组成
>`skiplist`中存储的键为`lookupkey`+`value`的长度+value。
—— leveldb源码分析之memtable
 <sup>[[2]](#ref2)</sup>


* <span id="ref1"></span>` [1] LevelDB源码剖析之MemTable
 `http://mingxinglai.com/cn/2013/01/leveldb-memtable/
* `<span id="ref2"></span>` [2] leveldb源码分析之memtable https://luodw.cc/2015/10/17/leveldb-06/