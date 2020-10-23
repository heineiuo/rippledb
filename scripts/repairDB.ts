import path from "path";
import { DBRepairer } from "../port/node";

async function main(): Promise<void> {
  try {
    const { DBPATH } = process.env;
    if (!DBPATH) console.log("DBPATH not found");
    const repairer = new DBRepairer(path.resolve(process.cwd(), DBPATH));
    await repairer.run();
    console.log(`Repair success: ${DBPATH}`);
  } catch (e) {
    console.log(e);
  }
}

main();
