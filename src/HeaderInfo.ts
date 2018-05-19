import * as vscode from 'vscode';

export class HeaderLine {
  private _imports: string[] = [];
  private _module: string = '';
  private doNotMerge: boolean = false;

  constructor(mod: string, imports: string[], doNotMerge?: boolean) {
    this._module = mod;
    this._imports = imports;
    this.doNotMerge = doNotMerge || false;
    this.sortAndMerge();
    return this;
  }

  private sortAndMerge(): void {
    this._imports.sort((a, b) => {
      const lowA = a.toLocaleLowerCase();
      const lowB = b.toLocaleLowerCase();
      if (lowA > lowB) { return 1; } 
      else if (lowA < lowB) { return -1; }
      return 0;
    });

    for (let i = 0; i < this._imports.length-1; i++) {
      if (this._imports[i] === this._imports[i+1]) {
        this._imports.slice(i);
        i--;
      }
    }
  }

  public compare(cmpTo: HeaderLine) {
    if (this._module !== cmpTo.getModule()) {
      return false;
    }
    if (this._imports.length !== cmpTo.getImports().length) {
      return false;
    }

    const cmpImports = cmpTo.getImports();
    for (let i = 0; i < cmpImports.length; i++) {
      if (this._imports[i] !== cmpImports[i]) {
        return false;
      }
    }

    return true;
  }

  public canMerge() {
    return !this.doNotMerge;
  }

  public merge(line: HeaderLine) {
    if (this._module === line.getModule()) {
      this._imports = this._imports.concat(line.getImports());
      this.sortAndMerge();
    }

    this.sortAndMerge();
  }

  public getImports() : string[] {
    return this._imports;
  }

  public getModule() : string {
    return this._module;
  }

  public addImport(str: string): void {
    if (this._imports.indexOf(str) === -1) {
      this._imports.push(str);
    }
    this.sortAndMerge();
  }

  public toString() : string {
    let imports = this._imports.join(', ');

    if (this._imports.length === 0) {
      return `import ${this._module};`;
    }

    if (this._imports.length > 1 || this._imports[0].indexOf('*') !== 0) {
      imports = `{ ${imports} }`;
    }
    return `import ${imports} from ${this._module};`;
  }
}

export class HeaderInfo {
  public lines: HeaderLine[] = [];
  public range: vscode.Range = new vscode.Range(0,0,0,0);

  constructor() {
    return this;
  }

  public push(module: string, imports: string[], doNotMerge?: boolean): void;
  public push(HeaderLine: HeaderLine): void;
  public push(): void {
    let newLine: HeaderLine = arguments[0];
    if (arguments.length >= 2) {
      newLine = new HeaderLine(arguments[0], arguments[1], arguments[2] || false);
    }
    
    if (newLine.canMerge()) {
      for (let i = 0; i < this.lines.length; i++) {
        if (!this.lines[i].canMerge()) {
          continue;
        }
        if (newLine.getModule() === this.lines[i].getModule()) {
          this.lines[i].merge(newLine);
          return;
        }
      }
    }
    

    this.lines.push(newLine);
  }

  public setRange(startPosition: vscode.Position, endPosition: vscode.Position): void;
  public setRange(startLine: number, startChar: number, endLine: number, endChar: number): void;
  public setRange(): void {
    if (arguments.length === 2) {
      this.range = new vscode.Range(arguments[0], arguments[1]);
    } else {
      this.range = new vscode.Range(arguments[0], arguments[1], arguments[2], arguments[3]);
    }
  }

  public getRange(): vscode.Range {
    return this.range;
  }

  private sortAndMerge(): void {
    this.lines.sort((a, b) => {
      const lenA = a.getImports().length;
      const lenB = b.getImports().length;

      const modA = a.getModule().toLocaleLowerCase();
      const modB = b.getModule().toLocaleLowerCase();

      const canA = a.canMerge();
      const canB = b.canMerge();

      //Sort no imports to the bottom
      if (lenA !== lenB) {
        if (lenA === 0) {
          return 1;
        } else if (lenB === 0) {
          return -1;
        }
      }

      if (modA > modB) { return -1; }
      if (modA < modB) { return 1; }

      // If one is unable to merge, sort to the bottom
      if (canA !== canB) {
        if (canA) {
          return 1;
        }
        return -1;
      }
      return 0;
    });

    for (let i = 0; i < this.lines.length-1; i++) {
      if (this.lines[i].compare(this.lines[i+1])) {
        this.lines.slice(i);
        continue;
      }
      if (this.lines[i].getModule() === this.lines[i+1].getModule()) {
        if (!this.lines[i].canMerge() || !this.lines[i+1].canMerge()) {
          continue;
        }
        this.lines[i].merge(this.lines[i+1]);
        this.lines.slice(i+1);
        i--;
      }
    }
  }

  public toString(): string {
    this.sortAndMerge();
    const out: string[] = [];
    let lastImports = 0;
    
    for (let i = 0; i < this.lines.length; i++) {
      const importCount = this.lines[i].getImports().length;
      if (importCount === 0 && i > 0) {
        if (lastImports > 0) {
          out.push('');
        }
      }
      lastImports = importCount;
      out.push(this.lines[i].toString());
    }

    return out.join('\n');
  }
}