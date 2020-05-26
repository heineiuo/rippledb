import path from "path";
import { Transformer } from "./Transformer";

async function transform(): Promise<void> {
  const transformer = new Transformer();
  await transformer.transform(
    path.resolve(__dirname, "../src"),
    path.resolve(__dirname, "../rippledb-deno"),
  );
  console.log("Transform success");
}

transform();
