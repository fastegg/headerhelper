import * as vscode from 'vscode';

declare global {
  export interface HeaderMod {
    text: string;
    mod: string;
  }
  export interface HeaderLine {
    text: string;
    source: string;
    mods: HeaderMod[];
  }

  export interface Headers {
    lines: HeaderLine[];
    range: vscode.Range;
  }

  export interface HeaderInfo {
    lines: HeaderLine[];
    range: vscode.Range;
  }

  export interface Location {
    line: number;
    character: number;
  }

  export interface Range {
    start: Location;
    end: Location;
  }
}

