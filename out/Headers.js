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
const path = require("path");
const js = require("./opts/js");
const optsTree = {
    js: js,
    ts: js,
    jsx: js,
    tsx: js,
};
class Headers {
    constructor(uri) {
        this.uri = null;
        this.doc = '';
        this.ext = '';
        this.opts = null; //todo type this
        this.info = null;
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
    getHeaderItems(uri) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.opts) {
                return [];
            }
            return this.opts.getHeaderItems(uri);
        });
    }
    getSecondaryImports(uri, initalImport) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.opts || !this.opts.getSecondaryImports) {
                return;
            }
            return yield this.opts.getSecondaryImports(uri, initalImport);
        });
    }
    addFromQuickPick(item, secondary) {
        if (!this.info) {
            return;
        }
        this.info.push(this.opts.quickPickItemToHeaderLine(this.uri, item, secondary));
    }
    push(module, imports) {
        if (this.info) {
            this.info.push.apply(this.info, arguments);
        }
    }
    getRange() {
        if (this.info) {
            return this.info.getRange();
        }
        else {
            return new vscode.Range(0, 0, 0, 0);
        }
    }
    toString() {
        if (this.info) {
            return this.info.toString();
        }
        return '';
    }
}
exports.default = Headers;
//# sourceMappingURL=Headers.js.map