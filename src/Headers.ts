import * as vscode from 'vscode';
import * as path from 'path';
import * as js from './opts/js';
import { HeaderInfo } from './HeaderInfo';

const optsTree: {[s: string]: any} = {
  js: js,
  ts: js,
  jsx: js,
  tsx: js,
};

export default class Headers {
  private uri: vscode.Uri | null = null;
  private doc: string = '';
  private ext: string = '';
  private opts: any = null; //todo type this
  private info: HeaderInfo | null = null;

  constructor(uri: vscode.Uri) {
    this.ext = path.extname(uri.fsPath).slice(1);
    this.uri = uri;
    this.opts = optsTree[this.ext];

    if (!this.opts) {
      throw new Error('Unable to find options for extention type: ' + this.ext);
    }

    for (const doc of vscode.workspace.textDocuments) {
      if (doc.uri.fsPath === uri.fsPath) {
        this.doc = doc.getText();
        //@ts-ignore
        this.info = this.opts.parseHeaders(this.doc);
        break;
      }
    }
    
    if (!this.doc) {
      throw new Error(`Unable to find open document ${uri.fsPath}`);
    }
  }

  async getHeaderItems(uri: vscode.Uri): Promise<vscode.QuickPickItem[]> {
    if (!this.opts) {
      return [];
    }

    return this.opts.getHeaderItems(uri);
  }

  async getSecondaryImports(uri: vscode.Uri, initalImport: vscode.QuickPickItem): Promise<vscode.QuickPickItem[] | undefined> {
    if (!this.opts || !this.opts.getSecondaryImports) {
      return;
    }
    return await this.opts.getSecondaryImports(uri, initalImport);
  }

  addFromQuickPick(item: vscode.QuickPickItem, secondary?: vscode.QuickPickItem) {
    if (!this.info) {
      return;
    }

    this.info.push(this.opts.quickPickItemToHeaderLine(this.uri, item, secondary));
  }

  push(module: string, imports: string[]) {
    if (this.info) {
      this.info.push.apply(this.info, arguments);
    }
  }

  getRange() {
    if (this.info) {
      return this.info.getRange();
    } else {
      return new vscode.Range(0, 0, 0, 0);
    }
  }

  toString(): string {
    if (this.info) {
      return this.info.toString();
    } 
    return '';
  }
}