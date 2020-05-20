type Callback = () => void;

export default {
  onExit<T extends Callback>(callback: T): void {
    callback();
  },
};
