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
const vscode = require("vscode");
const fs_1 = require("fs");
const path = require("path");
function getAllFiles(startDir) {
    return __awaiter(this, void 0, void 0, function* () {
        const out = [];
        function recur(dir) {
            return __awaiter(this, void 0, void 0, function* () {
                const ls = yield fs_1.readdirSync(dir);
                for (let i in ls) {
                    const file = ls[i];
                    if (file === '..' || file[0] === '.') {
                        continue;
                    }
                    //TODO: get ignore dirs
                    if (file === 'node_modules') {
                        continue;
                    }
                    if (file === 'build') {
                        continue;
                    }
                    if (fs_1.statSync(dir + '/' + file).isDirectory()) {
                        yield recur(dir + '/' + file);
                    }
                    else {
                        const ext = path.extname(file);
                        if (!ext.match(/[tj]sx?$/)) {
                            continue;
                        }
                        out.push({
                            label: file,
                            description: path.relative(startDir, dir + '/' + file),
                        });
                    }
                }
            });
        }
        yield recur(startDir);
        return out;
    });
}
exports.getAllFiles = getAllFiles;
function sortHeaders(headerInfo) {
    function cmp(a, b) {
        if (a.source > b.source) {
            return 1;
        }
        else if (b.source < a.source) {
            return -1;
        }
        return 0;
    }
    headerInfo.lines.sort(cmp);
    return headerInfo;
}
exports.sortHeaders = sortHeaders;
function replaceInDoc(uri, info) {
    return __awaiter(this, void 0, void 0, function* () {
        const wse = new vscode.WorkspaceEdit();
        let lines = [];
        for (let i = 0; i < info.lines.length; i++) {
            lines.push(info.lines[i].text);
        }
        const txe = new vscode.TextEdit(info.range, lines.join('\n'));
        wse.set(uri, [txe]);
        yield vscode.workspace.applyEdit(wse);
    });
}
exports.replaceInDoc = replaceInDoc;
function editDoc(uri, str, range) {
    return __awaiter(this, void 0, void 0, function* () {
        const wse = new vscode.WorkspaceEdit();
        const txe = new vscode.TextEdit(range, str);
        wse.set(uri, [txe]);
        yield vscode.workspace.applyEdit(wse);
    });
}
exports.editDoc = editDoc;
//# sourceMappingURL=helpers.js.map