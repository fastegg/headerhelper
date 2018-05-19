
import * as vscode from 'vscode';
import { readdirSync, statSync } from 'fs';
import * as path from 'path';

export async function getAllFiles(startDir: string): Promise<vscode.QuickPickItem[]> {
  const out: vscode.QuickPickItem[] = [];
  async function recur(dir: string) {
    const ls = await readdirSync(dir);

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

      if (statSync(dir + '/' + file).isDirectory()) {
        await recur(dir + '/' + file);
      } else {
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
  }

  await recur(startDir);

  return out;
}

export function sortHeaders(headerInfo: Headers) : Headers {
  function cmp(a: HeaderLine, b: HeaderLine): number {
    if (a.source > b.source) {
      return 1;
    } else if (b.source < a.source) {
      return -1;
    }

    return 0;
  }

  headerInfo.lines.sort(cmp);

  return headerInfo;
}

export async function replaceInDoc(uri: vscode.Uri, info: Headers) {
  const wse = new vscode.WorkspaceEdit();
  let lines = [];

  for (let i = 0; i < info.lines.length; i++) {
    lines.push(info.lines[i].text);
  }
  const txe = new vscode.TextEdit(info.range, lines.join('\n'));

  wse.set(uri, [txe]);
  await vscode.workspace.applyEdit(wse);
}

export async function editDoc(uri: vscode.Uri, str: string, range: vscode.Range) {
  const wse = new vscode.WorkspaceEdit();
  const txe = new vscode.TextEdit(range, str);
  wse.set(uri, [txe]);
  await vscode.workspace.applyEdit(wse);
}