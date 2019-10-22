# Compaction

Trigger major compaction condition

1. manually compact
2. filter seek miss > allowed_seeks(25)
3. level0 table > 8
4. level_i(i>0) table bytes > 10^i MB
