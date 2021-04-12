import * as vscode from 'vscode';
import * as path from 'path';
import { dectFileType, getSubPathBySymbol, getSymbol, wordsToPath } from './utils';
import { FileType, PATTERNS, REL_MODELS } from './constants';
import * as inflection from 'inflection2';
import fs from 'fs';
import SkeemaParser from './skeemaParser';
import { markdownTable } from './markdown-table';

export class RailsHover implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const symbol = getSymbol(document, position);
    if(!symbol){
      return undefined
    }
    const demodulized = inflection.demodulize(symbol);
    if (PATTERNS.CAPITALIZED.test(demodulized)) {
      console.log(symbol)
      const tableName = inflection.tableize(symbol);
      const root = vscode.workspace.getWorkspaceFolder(document.uri).uri.fsPath;
      const schemaPath = path.join(root, 'db', 'schema.rb');
      if (!fs.statSync(schemaPath)) {
        return undefined;
      }
      const schema = fs.readFileSync(schemaPath).toString();
      const parser = new SkeemaParser(schema);
      const tables = parser.parse();
      if (typeof tables !== 'undefined') {
        console.log('RailsHover', tableName, tables);
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
    }
    }
   

}
