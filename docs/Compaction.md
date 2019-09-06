## 合并sstable操作：

0. 将需要合并的所有sstable的kv取出来放进一个数组
0. 使用merge sort排序数组
0. 写入新的sstable