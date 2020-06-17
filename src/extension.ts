'use strict';

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { RailsHelper } from './rails_helper';
import { RailsDefinitionProvider } from './rails_definition';
import { RailsCompletionItemProvider } from './rails_completion';
import { ViewDefinitionProvider } from './viewRef';
import { viewDoc } from './view_doc';
import { Formatter } from './formatter';
import * as fs from 'fs';
import * as readline from 'readline';

const RAILS_MODE: vscode.DocumentFilter = { language: 'ruby', scheme: 'file' };
const VIEW_MODE: vscode.DocumentFilter = {
  pattern: '**/views/**',
  scheme: 'file',
};

function railsNavigation() {
  if (!vscode.window.activeTextEditor) {
    return;
  }

  const relativeFileName = vscode.workspace.asRelativePath(
    vscode.window.activeTextEditor.document.fileName
  );

  const line = vscode.window.activeTextEditor.document
    .lineAt(vscode.window.activeTextEditor.selection.active.line)
    .text.trim();

  const rh = new RailsHelper(relativeFileName, line);
  rh.showFileList();
}

function registerFormatter(context: vscode.ExtensionContext) {
  console.log('registerFormatter');
  const docType: string[] = ['css.erb', 'scss.erb', 'html.erb'];

  for (let i = 0, l = docType.length; i < l; i++) {
    registerDocType(docType[i]);
  }

  const formatter = new Formatter();

  context.subscriptions.push(
    vscode.commands.registerCommand('erb.formatting', () => {
      formatter.beautify();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onWillSaveTextDocument((e) => {
      formatter.onSave(e);
    })
  );

  function registerDocType(type) {
    // context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(type, {
    //   provideDocumentFormattingEdits: (document, options, token) => {
    //     return formatter.registerBeautify(null)
    //   }
    // }));
    // Note: A document range provider is also a document formatter
    // which means there is no need to register a document formatter when also registering a range provider.
    context.subscriptions.push(
      vscode.languages.registerDocumentRangeFormattingEditProvider(type, {
        provideDocumentRangeFormattingEdits: (
          document,
          range,
          options,
          token
        ) => {
          const start = new vscode.Position(0, 0);
          const end = new vscode.Position(
            document.lineCount - 1,
            document.lineAt(document.lineCount - 1).text.length
          );
          return formatter.registerBeautify(new vscode.Range(start, end));
        },
      })
    );
  }
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('Rails:Navigation', railsNavigation)
  );
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      RAILS_MODE,
      new RailsDefinitionProvider()
    )
  );
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { scheme: 'file' },
      new RailsCompletionItemProvider(),
      '.',
      '"',
      ':',
      "'"
    )
  );

  // since VIEW_MODE use glob pattern ,must make sure work on a rails project
  function registerViewDefinitionProvider() {
    context.subscriptions.push(
      vscode.languages.registerDefinitionProvider(
        VIEW_MODE,
        new ViewDefinitionProvider()
      )
    );
  }

  function registerViewDocCommand() {
    context.subscriptions.push(
      vscode.commands.registerCommand('Rails:Document', viewDoc, context)
    );
  }

  vscode.workspace.findFiles('Gemfile').then(async (uris: vscode.Uri[]) => {
    if (uris.length === 1) {
      const fileAbsPath = uris[0].fsPath;
      const fileStream = fs.createReadStream(fileAbsPath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });
      for await (const lineText of rl) {
        if (/gem\s+['"]rails['"]/.test(lineText)) {
          registerViewDefinitionProvider();
          registerViewDocCommand();
          registerFormatter(context);
          console.log('Project Gemfile contains rails');
          break;
        }
      }
    }
  });
}
// this method is called when your extension is deactivated
// export function deactivate() {}
