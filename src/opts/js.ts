//@ts-ignore
//import * as ts from 'typescript-eslint-parser';
import { HeaderInfo, HeaderLine } from '../HeaderInfo';
import * as vscode from 'vscode';
import { watch , readFile, stat, readdir} from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const opts = {
  allowedExts: ['js', 'ts', 'jsx', 'tsx', 'json'],
  stripExts: ['js', 'ts'],
  ingoreDirs: [
    './node_modules',
    './build',
  ],
};

function relative(from: string, to: string): string {
  const rel = path.relative(from, to);

  if (rel[0] === '.') {
    return rel;
  }
  return './' + rel;
}

function stripExts(fsPath: string): string {
  const ext = path.extname(fsPath).slice(1);
  if (opts.stripExts.indexOf(ext) !== -1) {
    return fsPath.slice(0, ((ext.length + 1) * -1));
  }
  return fsPath;
}

const moduleLookup: {[fs: string]: vscode.QuickPickItem[]} = {};
const fileLookup: {[fs: string]: {[file: string]: true}} = {};

async function processPath(root: string, dest: string): Promise<void> {
  if (opts.ingoreDirs.indexOf(dest) >= 0) {
    return;
  }
  const fullName = path.join(root, dest);
  const stats: any = await new Promise((resolve, reject) => {
    stat(path.join(root, dest), (err, stats) => {
      if (err) { delete fileLookup[root][dest]; return reject(err); }
      resolve(stats);
    });
  });

  if (stats.isDirectory()) {
    await new Promise((resolve, reject) => {
      readdir(fullName, async (err, ls) => {
        if (err) { return reject(err); }
        for (let i in ls) {
          if (ls[i][0] === '.') {
            continue;
          }
          await processPath(root, dest + '/' + ls[i]);
        }
        resolve();
      });
    });
  } else if(stats.isFile()) {
    const ext = path.extname(fullName).slice(1);

    if (opts.allowedExts.indexOf(ext) >= 0) {
      fileLookup[root][fullName] = true;
    }
    return;
  }
}

function processNames(root: string, relTo: string): vscode.QuickPickItem[] {
  const out: vscode.QuickPickItem[] = [];

  for (const file in fileLookup[root]) {
    let pth = stripExts(relative(relTo, file));
    let rel = relative(root, file);

    out.push({
      label: path.basename(file),
      detail: rel,
      description: `import from '${pth}';`,
    });
  }

  return out;
}

async function getImportFiles(wsuri: vscode.Uri, furi: vscode.Uri): Promise<vscode.QuickPickItem[]> {
  if (fileLookup[wsuri.fsPath]) {
    return processNames(wsuri.fsPath, furi.fsPath);
  }

  fileLookup[wsuri.fsPath] = {};

  await processPath(wsuri.fsPath, '.');
  watch(wsuri.fsPath, {recursive: true}, (event, filename) => {
    const rel = path.relative(wsuri.fsPath, filename.toString());
    processPath(wsuri.fsPath, rel);
  });

  return processNames(wsuri.fsPath, path.dirname(furi.fsPath));
}

async function loadPackage(uriPath: string): Promise<vscode.QuickPickItem[]> {
  const pkgContents = await new Promise<string>((resolve, reject) => {
    readFile(path.join(uriPath, 'package.json'), (err: Error, data: Buffer) => {
      if (err) { return reject(err); }
      resolve(data.toString());
    });
  });

  const pkgJson = JSON.parse(pkgContents);
  const found: vscode.QuickPickItem[] = [];

  for (let mod in pkgJson.devDependencies) {
    //todo ignore some mods?
    if (mod.startsWith('@types/')) { //Ignore all type modules
      continue;
    }

    found.push({
      label: mod,
      detail: 'dev dependency',
      description: `v ${pkgJson.devDependencies[mod]}`,
    });
  }

  for (let mod in pkgJson.dependencies) {
    found.push({
      label: mod,
      detail: 'module',
      description: `v ${pkgJson.dependencies[mod]}`,
    });
  }

  return found;
}

async function getPackageModules(uri: vscode.Uri): Promise<vscode.QuickPickItem[]> {
  const workspaceURI = vscode.workspace.getWorkspaceFolder(uri);

  if (!workspaceURI) {
    vscode.window.showWarningMessage(`unknown workspace for ${uri.path}, unable to load modules`);
    return [];
  }

  if (moduleLookup[workspaceURI.uri.fsPath]) {
    //Already loaded and watching for changes
    return moduleLookup[workspaceURI.uri.fsPath];
  }

  moduleLookup[workspaceURI.uri.fsPath] = await loadPackage(workspaceURI.uri.fsPath);
  watch(path.join(workspaceURI.uri.fsPath, 'package.json'), async () => {
    moduleLookup[workspaceURI.uri.fsPath] = await loadPackage(workspaceURI.uri.fsPath);
  });

  return moduleLookup[workspaceURI.uri.fsPath];
}

export async function getHeaderItems(uri: vscode.Uri): Promise<vscode.QuickPickItem[]> {
  const wsf = vscode.workspace.getWorkspaceFolder(uri);
  if (!wsf) {
    return [];
  }
  const out: vscode.QuickPickItem[] = await getPackageModules(wsf.uri);
  return out.concat(await getImportFiles(wsf.uri, uri));
}

function processNodeForExports(node: ts.Node): vscode.QuickPickItem[] {
  let out: vscode.QuickPickItem[] = [];

  switch(node.kind) {
    case ts.SyntaxKind.ExportDeclaration:
    case ts.SyntaxKind.ExportAssignment:
    case ts.SyntaxKind.NamedExports:
    case ts.SyntaxKind.ExportSpecifier:
    case ts.SyntaxKind.NamespaceExportDeclaration:
    case ts.SyntaxKind.ModuleDeclaration:
    case ts.SyntaxKind.ModuleBlock:
    case ts.SyntaxKind.ModuleKeyword:
      console.log(node.getText());
      console.log(node);
    case ts.SyntaxKind.ExportKeyword:
      const parent = node.parent;
      if (!parent) {
        break;
      }
      switch(parent.kind) {
        case ts.SyntaxKind.FunctionDeclaration:
        const name = (<ts.FunctionDeclaration>parent).name;
        if (name) {
          out.push({
            label: name.text,
            description: `line: ${parent.getSourceFile().getLineAndCharacterOfPosition(parent.getFullStart()).line}`,
          });
        }
        break;
        case ts.SyntaxKind.VariableStatement:
          const children = (<ts.VariableStatement>parent).declarationList.declarations;
          for (let i = 0; i < children.length; i++) {
            out.push({
              label: children[i].name.getText(),
              description: `line: ${parent.getSourceFile().getLineAndCharacterOfPosition(parent.getFullStart()).line}`,
            });
          }
      }
  }

  node.forEachChild((child) => {
    out = out.concat(processNodeForExports(child));
  });

  return out;
}

async function processFileForExports(file: string): Promise<vscode.QuickPickItem[]> {
  const out = await new Promise<vscode.QuickPickItem[]>((resolve, reject) => {
    readFile(file, (err, data) => {
      if (err) { return reject(err); }
      const config = ts.getDefaultCompilerOptions();

      config.allowJs = true;
      config.jsx = ts.JsxEmit.React;

      //ts.createProgram([file], config);
      const sourceFile = ts.createSourceFile(file, data.toString(), ts.ScriptTarget.ES2015, true);
      resolve(processNodeForExports(sourceFile));
    });
  }).catch((err) => {
    vscode.window.showWarningMessage('Unable to open file: ' + file);
  });

  return out || [];
}

export async function getSecondaryImports(uri: vscode.Uri, initalImport: vscode.QuickPickItem): Promise<vscode.QuickPickItem[] | undefined> {
  let out: vscode.QuickPickItem[];
  const isModule = initalImport.detail === 'dev dependency' || initalImport.detail === 'module';
  const source: string = <string>(isModule ? initalImport.label : initalImport.detail);
  const wsFolder = vscode.workspace.getWorkspaceFolder(uri);

  if (!wsFolder) {
    return;
  }

  if (isModule) {
    
    out = await new Promise<vscode.QuickPickItem[]>(async (resolve, reject) => {
      const pkgDir = path.join(wsFolder.uri.fsPath, `./node_modules/${source}/package.json`);

      readFile(pkgDir, async (err, contents) => {
        if (err) { return reject(err); }
        const pkgJson = JSON.parse(contents.toString());
        const file = pkgJson.main || 'index.js';
        
        resolve(await processFileForExports(path.join(wsFolder.uri.fsPath, `./node_modules/${source}`, file)));
      });
    });
  } else {
    out = await processFileForExports(path.resolve(wsFolder.uri.fsPath, source));
  }

  out.push({
    label: `* as ${generateImportName(initalImport.label)}`,
    description: `import * as ${generateImportName(initalImport.label)} from '${source}';`,
    detail: 'import all'
  });

  out.push({
    label: '',
    description: `import from '${source}'`,
    detail: 'import only',
  });

  return out;
}

function findImportBlocks(node: ts.Node) : HeaderInfo | null {
  const source: ts.SourceFile = node.getSourceFile();
  const children = node.getChildren();
  const rtn = new HeaderInfo();
  let startPosition: vscode.Position | undefined;
  let endPosition: vscode.Position;

  if (!source) {
    return null;
  }
  
  for (const child of children) {
    if (child.kind === ts.SyntaxKind.ImportDeclaration) {
      const importLine = child as ts.ImportDeclaration;
      const pos = source.getLineAndCharacterOfPosition(child.getStart(source));
      const end = source.getLineAndCharacterOfPosition(child.getEnd());
      
      if (!startPosition) {
        startPosition = new vscode.Position(pos.line, pos.character);
      }
      endPosition = new vscode.Position(end.line, end.character);

      const imports: string[] = [];
      const sourceText = importLine.moduleSpecifier.getFullText(source);

      if (importLine.importClause) {
        if (importLine.importClause.namedBindings) {
          const namedBindings = importLine.importClause.namedBindings as any;
          if (namedBindings.elements) {
            for (const elm of namedBindings.elements) {
              imports.push(elm.name.text);
            }
          } else {
            imports.push(namedBindings.getText());
          }
        }
      }
      let doNotMerge = false;
      if (child.getText().indexOf('{') === -1) {
        doNotMerge = true;
      }

      rtn.push(sourceText.trim(), imports, doNotMerge);
    } else {
      break;
    }
  }

  if (!startPosition) {
    startPosition = new vscode.Position(0, 0);
    endPosition = new vscode.Position(0, 0);
  }
  
  rtn.setRange(startPosition, endPosition!);

  return rtn;
}

export function parseHeaders(doc: string) : HeaderInfo {
  let rtn = new HeaderInfo(); //Return blank header info as default
  const rootNode = ts.createSourceFile('filename', doc, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TS);
  const children = rootNode.getChildren();

  
  for (const child of children) {
    if (child.kind === ts.SyntaxKind.SyntaxList) {
      const headerInfo = findImportBlocks(child);

      return headerInfo || rtn;
    }
  }

  return rtn;
}

function generateImportName(modName: string): string {
  return modName;
}

export function quickPickItemToHeaderLine(uri: vscode.Uri, source: vscode.QuickPickItem, item?: vscode.QuickPickItem): HeaderLine {
  const isModule = source.detail && (source.detail === 'dev dependency' || source.detail === 'module');
  let importName = item ? item.label : `* as ${generateImportName(source.label)}`;
  const importList = [];
  
  if (importName !== '') {
    importList.push(importName);
  }
  const doNotMerge = importList.length === 0 || importList[0].indexOf('* as') !== -1;

  if (isModule) {
    return new HeaderLine(`'${source.label}'`, importList, doNotMerge);
  } else {
    const root = vscode.workspace.getWorkspaceFolder(uri);

    if (!root) {
      throw new Error('Workspace root not defined');
    }
    const relPath = stripExts(relative(path.dirname(uri.fsPath), path.join(root.uri.fsPath, source.detail as string)));

    return new HeaderLine(`'${relPath}'`, importList, doNotMerge);
  }
}