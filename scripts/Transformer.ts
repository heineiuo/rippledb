import * as ts from "typescript";
import glob from "glob";
import path from "path";
import fs from "fs";

const addExtTransformer = <T extends ts.Node>(
  ctx: ts.TransformationContext,
) => (rootNode: T): T => {
  function nodeVisitor(): ts.Visitor {
    const visitor: ts.Visitor = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
        const node2 = ts.getMutableClone(node);
        let text = node2.moduleSpecifier.getText().trim();
        text = text.substr(1, text.length - 2);
        if (text.endsWith(".ts")) return node2;
        node2.moduleSpecifier = ts.createStringLiteral(text + ".ts");
        return node2;
      }

      if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        const node2 = ts.getMutableClone(node);
        let text = node2.moduleSpecifier.getText().trim();
        text = text.substr(1, text.length - 2);
        if (text.endsWith(".ts")) return node2;
        node2.moduleSpecifier = ts.createStringLiteral(text + ".ts");
        return node2;
      }

      return ts.visitEachChild(node, visitor, ctx);
    };
    return visitor;
  }
  return ts.visitNode(rootNode, nodeVisitor());
};

export class Transformer {
  async transform(sourceDir: string, targetDir: string): Promise<void> {
    const files = glob.sync(`${sourceDir}/**/*.ts`);
    await fs.promises.mkdir(targetDir, { recursive: true });
    for await (const file of files) {
      const sourceFilename = path.basename(file);
      const source = await fs.promises.readFile(file, "utf8");
      const relative = path.relative(sourceDir, file);
      const outputFile = path.resolve(targetDir, relative);
      const result = await this.transformFile(sourceFilename, source);
      await fs.promises.writeFile(outputFile, result, "utf8");
    }
  }

  transformFile(sourceFilename: string, source: string): string {
    const printer: ts.Printer = ts.createPrinter();

    const sourceFile: ts.SourceFile = ts.createSourceFile(
      sourceFilename,
      source,
      ts.ScriptTarget.ES2015,
      true,
      ts.ScriptKind.TS,
    );

    const result: ts.TransformationResult<ts.SourceFile> = ts.transform<
      ts.SourceFile
    >(sourceFile, [addExtTransformer]);

    const transformedSourceFile: ts.SourceFile = result.transformed[0];

    const transformed = printer.printFile(transformedSourceFile);
    result.dispose();
    return transformed;
  }
}
