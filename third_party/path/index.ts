function resolve(...pathes: string[]): string {
  return pathes.join("/");
}

export default {
  resolve,
};
