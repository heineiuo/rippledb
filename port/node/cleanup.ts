const DEFAULT_MESSAGES = {
  ctrlC: "[ctrl-C]",
  uncaughtException: "Uncaught exception...",
};

interface Messages {
  ctrlC: string;
  uncaughtException: string;
}

interface CleanupHandler {
  (code: number | null, signal?: string): boolean;
}

interface Handle {
  (...args: any[]): void;
}

const inited = false;
let cleanupHandlers: CleanupHandler[] = []; // array of cleanup handlers to call
let messages: Messages | null = null; // messages to write to stderr

let sigintHandler: Handle; // POSIX signal handlers
let sighupHandler: Handle;
let sigquitHandler: Handle;
let sigtermHandler: Handle;

function exceptionHandler(e: Error): void {
  if (messages && messages.uncaughtException !== "") {
    process.stderr.write(messages.uncaughtException + "\n");
  }
  process.stderr.write(e.stack + "\n");
  process.exit(1); // will call exitHandler() for cleanup
}

function exitHandler(exitCode: number): void {
  cleanupHandlers.forEach(function (cleanup) {
    cleanup(exitCode);
  });
}

export function uninstall(): void {
  if (cleanupHandlers.length > 0) {
    process.removeListener("SIGINT", sigintHandler);
    process.removeListener("SIGHUP", sighupHandler);
    process.removeListener("SIGQUIT", sigquitHandler);
    process.removeListener("SIGTERM", sigtermHandler);
    process.removeListener("uncaughtException", exceptionHandler);
    process.removeListener("exit", exitHandler);
    cleanupHandlers = [];
  }
}

function createSignalHandler(signal: string): Handle {
  return function (): void {
    let exit = true;
    cleanupHandlers.forEach(function (cleanup) {
      if (cleanup(null, signal) === false) exit = false;
    });
    if (exit) {
      if (signal === "SIGINT" && messages && messages.ctrlC !== "") {
        process.stderr.write(messages.ctrlC + "\n");
      }

      uninstall(); // don't cleanup again
      // necessary to communicate the signal to the parent process
      process.kill(process.pid, signal);
    }
  };
}

export function install(
  cleanupHandler: CleanupHandler,
  stderrMessages: Messages = DEFAULT_MESSAGES,
): void {
  if (messages === null) messages = { ctrlC: "", uncaughtException: "" };
  if (typeof stderrMessages.ctrlC === "string")
    messages.ctrlC = stderrMessages.ctrlC;
  if (typeof stderrMessages.uncaughtException === "string")
    messages.uncaughtException = stderrMessages.uncaughtException;

  if (!inited) {
    sigintHandler = createSignalHandler("SIGINT");
    sighupHandler = createSignalHandler("SIGHUP");
    sigquitHandler = createSignalHandler("SIGQUIT");
    sigtermHandler = createSignalHandler("SIGTERM");
    process.on("SIGINT", sigintHandler);
    process.on("SIGHUP", sighupHandler);
    process.on("SIGQUIT", sigquitHandler);
    process.on("SIGTERM", sigtermHandler);
    process.on("uncaughtException", exceptionHandler);
    process.on("exit", exitHandler);
  }
  cleanupHandlers.push(cleanupHandler);
}

export function onExit(callback: () => void): void {
  install(() => {
    callback();
    return true;
  });
}
