'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const helpers = require("./helpers");
const Headers_1 = require("./Headers");
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    let sort = vscode.commands.registerCommand('headers.sort', () => __awaiter(this, void 0, void 0, function* () {
        if (!vscode.window.activeTextEditor) {
            vscode.window.showErrorMessage('Unknown active document');
            return;
        }
        const uri = vscode.window.activeTextEditor.document.uri;
        const headers = new Headers_1.default(uri);
        helpers.editDoc(uri, headers.toString(), headers.getRange());
    }));
    context.subscriptions.push(sort);
    let insert = vscode.commands.registerCommand('headers.insert', () => __awaiter(this, void 0, void 0, function* () {
        if (!vscode.window.activeTextEditor) {
            vscode.window.showErrorMessage("Unknown active document");
            return;
        }
        const uri = vscode.window.activeTextEditor.document.uri;
        const headers = new Headers_1.default(uri);
        const newInclude = yield vscode.window.showQuickPick(headers.getHeaderItems(uri), { matchOnDescription: true });
        let secondaryImport;
        if (!newInclude) {
            return;
        }
        const secondaryList = yield headers.getSecondaryImports(uri, newInclude);
        if (secondaryList) {
            secondaryImport = yield vscode.window.showQuickPick(secondaryList);
            if (!secondaryImport) {
                return;
            }
        }
        headers.addFromQuickPick(newInclude, secondaryImport);
        helpers.editDoc(uri, headers.toString(), headers.getRange());
    }));
    context.subscriptions.push(insert);
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map