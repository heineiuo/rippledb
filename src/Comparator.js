
export function findShortestSeparator (string1, string2) {
  let index = 0
  let same = ''
  let base = ''
  while (true) {
    const left = string1[index]
    const right = string2[index]
    if (!left || !right) return same
    if (left > right) {
      base = right
      break
    }
    if (left < right) {
      base = left
      break
    }
    same += left
    index++
  }
  const nextChar = String.fromCharCode(base.charCodeAt() + 1)
  return `${same}${nextChar}`
}
