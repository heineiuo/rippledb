import path from "path";
import { Transformer } from "./Transformer";

// TODO
async function preversion(): Promise<void> {
  const transformer = new Transformer();
  console.log(
    path.resolve(__dirname, "../src"),
    path.resolve(__dirname, "../rippledb-deno"),
  );
  console.log("Run preversion success");
}

preversion();
