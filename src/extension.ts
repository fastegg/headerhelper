'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as helpers from './helpers';
import Headers from './Headers';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json

  let sort = vscode.commands.registerCommand('headers.sort', async () => {
    if (!vscode.window.activeTextEditor) {
      vscode.window.showErrorMessage('Unknown active document');
      return;
    }
    const uri = vscode.window.activeTextEditor.document.uri;
    const headers = new Headers(uri);
    
    helpers.editDoc(uri, headers.toString(), headers.getRange());
  });

  context.subscriptions.push(sort);

  let insert = vscode.commands.registerCommand('headers.insert', async () => {
    if (!vscode.window.activeTextEditor) {
      vscode.window.showErrorMessage("Unknown active document");
      return;
    }

    const uri = vscode.window.activeTextEditor.document.uri;
    const headers = new Headers(uri);

    const newInclude = await vscode.window.showQuickPick(headers.getHeaderItems(uri), {matchOnDescription: true});
    let secondaryImport: vscode.QuickPickItem | undefined;
    if (!newInclude) {
      return;
    }

    const secondaryList = await headers.getSecondaryImports(uri, newInclude);
    if (secondaryList) {
      secondaryImport = await vscode.window.showQuickPick(secondaryList);

      if (!secondaryImport) {
        return;
      }
    }

    headers.addFromQuickPick(newInclude, secondaryImport);

    helpers.editDoc(uri, headers.toString(), headers.getRange());
  });
  context.subscriptions.push(insert);
}

// this method is called when your extension is deactivated
export function deactivate() {
}