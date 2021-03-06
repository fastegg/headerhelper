import { watch, readFile, readFileSync, statSync } from 'fs';
import * as vscode from 'vscode';
import * as path from 'path';
import * as helpers from '../helpers';
//@ts-ignore
import * as ts from 'typescript-eslint-parser';

export const jsOpts = {
  ext: /\.[jt]sx?/,
  comments: /\/\//,
  multilineComments: {
    start: /\/\*/,
    end: /\*\//,
  },
  headerLines: [/^import * from .*/, /^(?:const)?(?:let)?(?:var)?\s+\S+\s?=\s?require\(['"](.*)['"]\)+/],
  sortBy: [/^import .* from ["'](.*)["']/, /require\(['"](.*)['"]\)+/],
  getPossibleHeaders,
  getHeaderLineForModule,
  getImportName,
  getSubModules,
  addToHeaders,
};


const moduleLookup: {[propName: string]: string[]} = {};

function copyLocation(loc: {column?: number, character?: number, line: number}) : Location {
  if (loc.column) {
    return { character: loc.column, line: loc.line };
  } else {
    return loc as Location;
  }
}

export function findHeaders(doc: string) : Headers {
  const parsed = ts.parse(doc, { comment: true, tolerant: true, range: true });
  let start: Location = {line: 0, character: 0};
  let end: Location = {line: 0, character: 0};
  let bFoundblock = false;
  const headers: HeaderLine[] = [];

  //First look for all comment blocks at the top
  let lastCommentEnd = 0;
  for (let i = 0; i < parsed.comments.length; i++) {
    if (doc.slice(lastCommentEnd, parsed.comments[i].range[0]).trim() === '') {
      lastCommentEnd = parsed.comments[i].range[1];
      end = {line: parsed.comments[i].loc.end.line+1, character: 0};
      start = {line: parsed.comments[i].loc.end.line+1, character: 0};
    } else {
      break;
    }
  }

  function insertHeader(h: HeaderLine, r: Range) {
    headers.push(h);
    if (bFoundblock === false) {
      bFoundblock = true;
      start = copyLocation(r.start);
    }
    end = copyLocation(r.end);
  }

  for (let i = 0; i < parsed.body.length; i++) {
    const block = parsed.body[i];

    if (block.type === 'ImportDeclaration') {
      console.log(block.source.value);
      const headerLine: HeaderLine = {
        text: doc.slice(block.range[0], block.range[1]),
        source: block.source.value,
        mods: []
      };
      for (let m = 0; m < block.specifiers.length; m++) {
        headerLine.mods.push({
          text: doc.slice(block.specifiers[m].range[0], block.specifiers[m].range[1]),
          mod: block.specifiers[m].local.name,
        });
      }
      insertHeader(headerLine, block.loc);
      bFoundblock = true;
    } else if (block.type === 'VariableDeclaration') {
      /*
      for (let i = 0; i < block.declarations.length; i++) {
        if (block.declarations[i].type === 'VariableDeclarator' 
          && block.declarations[i].init === 'CallExpression'
          && block.declarations[i].callee === 'require'
        ) {
          const headerLine: HeaderLine = {
            text: doc.slice(block.range.start, block.range.end),
            source: 
          }
        }
      }
      */
     //TODO figure this out later
      break;
    } else {
      break;
    }
  }
  //console.log(ts);
  //const parsed = cherow.parseModule(doc, { ranges: true, tolerate: true, comments: true, next: true });

  return {
    lines: headers,
    range: new vscode.Range(new vscode.Position(start.line-1, start.character), new vscode.Position(end.line-1, end.character)),
  };
}

export async function getPossibleHeaders(uri: vscode.Uri) : Promise<vscode.QuickPickItem[]> {
  const rtn: vscode.QuickPickItem[] = [];
  const mods = await findModules(uri);

  if (mods) {
    for (var i = 0; i < mods.length; i++) {
      rtn.push({
        label: mods[i],
        description: 'module',
      });
    }
  }

  const workspaceURI = vscode.workspace.getWorkspaceFolder(uri);

  if (workspaceURI) {
    return rtn.concat(await helpers.getAllFiles(workspaceURI.uri.fsPath));
  }
  
  return rtn;
}

async function getFileExports(location: string): Promise<vscode.QuickPickItem[]> {
  const out: vscode.QuickPickItem[] = [];

  const stats = statSync(location);

  if (stats.isDirectory()) {
    try {
      const mods = require(location);

      for (let id in mods) {
        out.push({label: id, description: `import { ${id} } from '${location}'`});
      }
    } catch (e) {
      const fin = readFileSync(path.join(location, 'package.json')).toString();

      if (fin) {
        const pkg = JSON.parse(fin);

        if (pkg.main) {
          return getFileExports(path.join(location, pkg.main));
        }
      }
    }
  } else {
    const contents = readFileSync(location).toString();

    const parsed = ts.parse(contents, { comment: true, tolerant: true, range: true });

    for (let i = 0; i < parsed.body.length; i++) {
      if (parsed.body[i].type === 'ExportNamedDeclaration') {
        const body = parsed.body[i];
        let detail = `Line ${body.loc.start.line} of ${location}`;

        if (body.declaration) {
          const dec = body.declaration;
          if (dec.declarations) {
            for (var d = 0; d < dec.declarations.length; d++) {
              const label = dec.declarations[d].id.name;
              const description = `import { ${label} } from '${location}'`;
              out.push({label, description, detail });
            }
          } else {
            const label = body.declaration.id.name;
            const description = `import { ${label} } from '${location}'`;
            out.push({ label, description, detail });
          }
        }
      }
    }
  }

  return out;
}

async function getSubModules(workspacePath: string, moduleName: string, location: string): Promise<vscode.QuickPickItem[]> {
  const out: vscode.QuickPickItem[] = [];
  
  out.push({label: '*', description: `import * as ${getImportName(moduleName)} from ${moduleName}`});

  return out.concat(await getFileExports(path.join(workspacePath, (location === 'module' ? `node_modules/${moduleName}` : location))));
}

function addToHeaders(info: Headers, source: string, location: string, mod?: string) {
  if (location = 'module') {
    location = source;
  }

  for (let i = 0; i < info.lines.length; i++) {
    if (info.lines[i].source === location) {
      const text = mod || `* as ${getImportName(source)}`;
      mod = mod || source;
      for (let m = 0; m < info.lines[i].mods.length; m++) {
        if (info.lines[i].mods[m].mod === mod) {
          return;
        }
      }
      info.lines[i].mods.push({
        text,
        mod: mod || '*',
      });
      break;
    }
  }

  let text = `import * as ${getImportName(source)} from '${location}';`;

  if (mod) {
    text = `import { ${mod} } from '${location}';`;
  }

  info.lines.push({
    text,
    source,
    mods: mod ? [{text: mod, mod}] : [],
  });
}

function getImportName(moduleName: string) {
  const bIsModule = moduleName[0] !== '.' && moduleName[0] !== '/';

  if (moduleName.indexOf('/') !== -1) {
    moduleName = moduleName.slice(moduleName.lastIndexOf('/'));
  }

  let match = moduleName.match(/[\W-_]/g);
  if (match) {
    for (var i = 0; i < match.length; i++) {
      const index = moduleName.indexOf(match[i]);
      moduleName = moduleName.slice(0, index) + moduleName[index+1].toLocaleUpperCase() + moduleName.slice(index + 2);
    }
  }

  if (!bIsModule) {
    moduleName = moduleName[0].toLocaleUpperCase() + moduleName.slice(1);
  }

  return moduleName;
}

function getHeaderLineForModule(moduleName: string): string {
  return `import * as ${getImportName(moduleName)} from '${moduleName}';`;
}

async function findModules(uri: vscode.Uri): Promise<string[] | undefined> {
  const workspaceURI = vscode.workspace.getWorkspaceFolder(uri);

  if (!workspaceURI) {
    vscode.window.showErrorMessage(`unknown workspace for ${uri.path}, unable to load modules`);
    return;
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

async function loadPackage(uriPath: string): Promise<string[]> {
  const pkgContents = await new Promise<string>((resolve, reject) => {
    readFile(path.join(uriPath, 'package.json'), (err: Error, data: Buffer) => {
      if (err) { return reject(err); }
      resolve(data.toString());
    });
  });

  const pkgJson = JSON.parse(pkgContents);
  const found = [];

  for (let mod in pkgJson.devDependencies) {
    if (mod.startsWith('@types/')) { //Ignore all type modules
      continue;
    }

    found.push(mod);
  }

  for (let mod in pkgJson.dependencies) {
    found.push(mod);
  }

  return found;
}