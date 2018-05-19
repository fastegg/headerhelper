"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
//@ts-ignore
//import * as ts from 'typescript-eslint-parser';
const HeaderInfo_1 = require("../HeaderInfo");
const vscode = require("vscode");
const fs_1 = require("fs");
const path = require("path");
const ts = require("typescript");
const opts = {
    allowedExts: ['js', 'ts', 'jsx', 'tsx', 'json'],
    stripExts: ['js', 'ts'],
    ingoreDirs: [
        './node_modules',
        './build',
    ],
};
function relative(from, to) {
    const rel = path.relative(from, to);
    if (rel[0] === '.') {
        return rel;
    }
    return './' + rel;
}
function stripExts(fsPath) {
    const ext = path.extname(fsPath).slice(1);
    if (opts.stripExts.indexOf(ext) !== -1) {
        return fsPath.slice(0, ((ext.length + 1) * -1));
    }
    return fsPath;
}
const moduleLookup = {};
const fileLookup = {};
function processPath(root, dest) {
    return __awaiter(this, void 0, void 0, function* () {
        if (opts.ingoreDirs.indexOf(dest) >= 0) {
            return;
        }
        const fullName = path.join(root, dest);
        const stats = yield new Promise((resolve, reject) => {
            fs_1.stat(path.join(root, dest), (err, stats) => {
                if (err) {
                    delete fileLookup[root][dest];
                    return reject(err);
                }
                resolve(stats);
            });
        });
        if (stats.isDirectory()) {
            yield new Promise((resolve, reject) => {
                fs_1.readdir(fullName, (err, ls) => __awaiter(this, void 0, void 0, function* () {
                    if (err) {
                        return reject(err);
                    }
                    for (let i in ls) {
                        if (ls[i][0] === '.') {
                            continue;
                        }
                        yield processPath(root, dest + '/' + ls[i]);
                    }
                    resolve();
                }));
            });
        }
        else if (stats.isFile()) {
            const ext = path.extname(fullName).slice(1);
            if (opts.allowedExts.indexOf(ext) >= 0) {
                fileLookup[root][fullName] = true;
            }
            return;
        }
    });
}
function processNames(root, relTo) {
    const out = [];
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
function getImportFiles(wsuri, furi) {
    return __awaiter(this, void 0, void 0, function* () {
        if (fileLookup[wsuri.fsPath]) {
            return processNames(wsuri.fsPath, furi.fsPath);
        }
        fileLookup[wsuri.fsPath] = {};
        yield processPath(wsuri.fsPath, '.');
        fs_1.watch(wsuri.fsPath, { recursive: true }, (event, filename) => {
            const rel = path.relative(wsuri.fsPath, filename.toString());
            processPath(wsuri.fsPath, rel);
        });
        return processNames(wsuri.fsPath, path.dirname(furi.fsPath));
    });
}
function loadPackage(uriPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const pkgContents = yield new Promise((resolve, reject) => {
            fs_1.readFile(path.join(uriPath, 'package.json'), (err, data) => {
                if (err) {
                    return reject(err);
                }
                resolve(data.toString());
            });
        });
        const pkgJson = JSON.parse(pkgContents);
        const found = [];
        for (let mod in pkgJson.devDependencies) {
            //todo ignore some mods?
            if (mod.startsWith('@types/')) {
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
    });
}
function getPackageModules(uri) {
    return __awaiter(this, void 0, void 0, function* () {
        const workspaceURI = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceURI) {
            vscode.window.showWarningMessage(`unknown workspace for ${uri.path}, unable to load modules`);
            return [];
        }
        if (moduleLookup[workspaceURI.uri.fsPath]) {
            //Already loaded and watching for changes
            return moduleLookup[workspaceURI.uri.fsPath];
        }
        moduleLookup[workspaceURI.uri.fsPath] = yield loadPackage(workspaceURI.uri.fsPath);
        fs_1.watch(path.join(workspaceURI.uri.fsPath, 'package.json'), () => __awaiter(this, void 0, void 0, function* () {
            moduleLookup[workspaceURI.uri.fsPath] = yield loadPackage(workspaceURI.uri.fsPath);
        }));
        return moduleLookup[workspaceURI.uri.fsPath];
    });
}
function getHeaderItems(uri) {
    return __awaiter(this, void 0, void 0, function* () {
        const wsf = vscode.workspace.getWorkspaceFolder(uri);
        if (!wsf) {
            return [];
        }
        const out = yield getPackageModules(wsf.uri);
        return out.concat(yield getImportFiles(wsf.uri, uri));
    });
}
exports.getHeaderItems = getHeaderItems;
function processNodeForExports(node) {
    let out = [];
    switch (node.kind) {
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
            switch (parent.kind) {
                case ts.SyntaxKind.FunctionDeclaration:
                    const name = parent.name;
                    if (name) {
                        out.push({
                            label: name.text,
                            description: `line: ${parent.getSourceFile().getLineAndCharacterOfPosition(parent.getFullStart()).line}`,
                        });
                    }
                    break;
                case ts.SyntaxKind.VariableStatement:
                    const children = parent.declarationList.declarations;
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
function processFileForExports(file) {
    return __awaiter(this, void 0, void 0, function* () {
        const out = yield new Promise((resolve, reject) => {
            fs_1.readFile(file, (err, data) => {
                if (err) {
                    return reject(err);
                }
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
    });
}
function getSecondaryImports(uri, initalImport) {
    return __awaiter(this, void 0, void 0, function* () {
        let out;
        const isModule = initalImport.detail === 'dev dependency' || initalImport.detail === 'module';
        const source = (isModule ? initalImport.label : initalImport.detail);
        const wsFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!wsFolder) {
            return;
        }
        if (isModule) {
            out = yield new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                const pkgDir = path.join(wsFolder.uri.fsPath, `./node_modules/${source}/package.json`);
                fs_1.readFile(pkgDir, (err, contents) => __awaiter(this, void 0, void 0, function* () {
                    if (err) {
                        return reject(err);
                    }
                    const pkgJson = JSON.parse(contents.toString());
                    const file = pkgJson.main || 'index.js';
                    resolve(yield processFileForExports(path.join(wsFolder.uri.fsPath, `./node_modules/${source}`, file)));
                }));
            }));
        }
        else {
            out = yield processFileForExports(path.resolve(wsFolder.uri.fsPath, source));
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
    });
}
exports.getSecondaryImports = getSecondaryImports;
function findImportBlocks(node) {
    const source = node.getSourceFile();
    const children = node.getChildren();
    const rtn = new HeaderInfo_1.HeaderInfo();
    let startPosition;
    let endPosition;
    if (!source) {
        return null;
    }
    for (const child of children) {
        if (child.kind === ts.SyntaxKind.ImportDeclaration) {
            const importLine = child;
            const pos = source.getLineAndCharacterOfPosition(child.getStart(source));
            const end = source.getLineAndCharacterOfPosition(child.getEnd());
            if (!startPosition) {
                startPosition = new vscode.Position(pos.line, pos.character);
            }
            endPosition = new vscode.Position(end.line, end.character);
            const imports = [];
            const sourceText = importLine.moduleSpecifier.getFullText(source);
            if (importLine.importClause) {
                if (importLine.importClause.namedBindings) {
                    const namedBindings = importLine.importClause.namedBindings;
                    if (namedBindings.elements) {
                        for (const elm of namedBindings.elements) {
                            imports.push(elm.name.text);
                        }
                    }
                    else {
                        imports.push(namedBindings.getText());
                    }
                }
            }
            let doNotMerge = false;
            if (child.getText().indexOf('{') === -1) {
                doNotMerge = true;
            }
            rtn.push(sourceText.trim(), imports, doNotMerge);
        }
        else {
            break;
        }
    }
    if (!startPosition) {
        startPosition = new vscode.Position(0, 0);
        endPosition = new vscode.Position(0, 0);
    }
    rtn.setRange(startPosition, endPosition);
    return rtn;
}
function parseHeaders(doc) {
    let rtn = new HeaderInfo_1.HeaderInfo(); //Return blank header info as default
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
exports.parseHeaders = parseHeaders;
function generateImportName(modName) {
    return modName;
}
function quickPickItemToHeaderLine(uri, source, item) {
    const isModule = source.detail && (source.detail === 'dev dependency' || source.detail === 'module');
    let importName = item ? item.label : `* as ${generateImportName(source.label)}`;
    const importList = [];
    if (importName !== '') {
        importList.push(importName);
    }
    const doNotMerge = importList.length === 0 || importList[0].indexOf('* as') !== -1;
    if (isModule) {
        return new HeaderInfo_1.HeaderLine(`'${source.label}'`, importList, doNotMerge);
    }
    else {
        const root = vscode.workspace.getWorkspaceFolder(uri);
        if (!root) {
            throw new Error('Workspace root not defined');
        }
        const relPath = stripExts(relative(path.dirname(uri.fsPath), path.join(root.uri.fsPath, source.detail)));
        return new HeaderInfo_1.HeaderLine(`'${relPath}'`, importList, doNotMerge);
    }
}
exports.quickPickItemToHeaderLine = quickPickItemToHeaderLine;
//# sourceMappingURL=js.js.map