import * as vscode from 'vscode';
import * as path from 'path';
import {
  getSymbol,
} from './utils';
import { PATTERNS } from './constants';
import * as inflection from 'inflection2';
import fs from 'fs';
import SkeemaParser from './skeemaParser';
import { markdownTable } from './markdown-table';
import { promisify } from 'util';
import pathExists from 'path-exists';
const files = {};

function readFile(
  path: string,
  options: {
    encoding?: null;
    flag?: string;
  } = {},
  fn: (err: NodeJS.ErrnoException, data?: {}) => void
) {
  let _fn = fn;
  if (2 === arguments.length) {
    // @ts-ignore
    _fn = options;
    options = {};
  }

  if (!files[path]) files[path] = {};
  const file = files[path];

  fs.stat(path,  (err, stats) => {
    if (err) return _fn(err);
    else if (file.mtime >= stats.mtime) {
      return _fn(null, file.content);
    }

    fs.readFile(path, options,  (err, buf) => {
      if (err) return _fn(err);
      const parser = new SkeemaParser(buf.toString());
      const tables = parser.parse();
      files[path] = {
        mtime: stats.mtime,
        content: tables,
      };

      _fn(null, tables);
    });
  });
}

const _readFile = promisify(readFile);

export class RailsHover implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const symbol = getSymbol(document, position);
    if (!symbol) {
      return undefined;
    }
    const demodulized = inflection.demodulize(symbol);
    if (PATTERNS.CAPITALIZED.test(demodulized)) {
      const tableName = inflection.tableize(symbol);
      const root = vscode.workspace.getWorkspaceFolder(document.uri).uri.fsPath;
      const schemaPath = path.join(root, 'db', 'schema.rb');
      if (!files[schemaPath] && !pathExists.sync(schemaPath)) {
        return undefined;
      }
      return _readFile(schemaPath, {}).then((tables) => {
        if (typeof tables !== 'undefined') {
          if (tableName in tables) {
            const table = tables[tableName];
            const tablemd = [['Field', 'Type']];
            Object.entries(table).forEach(([key, val]) => {
              tablemd.push([
                `<span style="color:#008000;">${key}</span>`,
                `<span style="color:#cc0000;">${val.toString()}</span>`,
              ]);
            });
            const md = markdownTable(tablemd);
            const mds = new vscode.MarkdownString(md);
            mds.isTrusted = true;
            return new vscode.Hover(mds);
          }
        }
      });
    }
  }
}
