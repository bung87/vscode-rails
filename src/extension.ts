import vscode from 'vscode';
import { NavigationHelper } from './navigation/navigation_helper';
import { RailsDefinitionProvider } from './rails_definition';
import { RailsCompletionItemProvider } from './rails_completion';
import { ViewDefinitionProvider } from './viewRef';
import { viewDoc } from './view_doc';
import { Formatter } from './formatter';
import fs from 'fs';
import readline from 'readline';
import { gitignores, LocalBundle } from './utils';
// import parseGitignore from 'gitignore-globs';
import { globifyGitIgnoreFile } from 'globify-gitignore';
import path from 'path';
import { RailsHover } from './rails_hover';

const RAILS_MODE: vscode.DocumentFilter = { language: 'ruby', scheme: 'file' };
const VIEW_MODE: vscode.DocumentFilter = {
  pattern: '**/views/**',
  scheme: 'file',
};

let gitignoreWatcher: vscode.FileSystemWatcher;

function railsNavigation() {
  if (!vscode.window.activeTextEditor) {
    return;
  }

  const line = vscode.window.activeTextEditor.document
    .lineAt(vscode.window.activeTextEditor.selection.active.line)
    .text.trim();

  const rh = new NavigationHelper(
    vscode.window.activeTextEditor.document,
    line
  );
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
      void formatter.beautify();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onWillSaveTextDocument((e) => {
      formatter.onSave(e);
    })
  );

  function registerDocType(type: string) {
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
    vscode.languages.registerHoverProvider(RAILS_MODE, new RailsHover())
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

  void vscode.workspace
    .findFiles('Gemfile', LocalBundle, vscode.workspace.workspaceFolders.length)
    .then(async (uris: vscode.Uri[]) => {
      if (uris.length >= 1) {
        for (const uri of uris) {
          const fileAbsPath = uri.fsPath;
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
      }
    });

  // initial gitignore glob
  vscode.workspace.workspaceFolders.map((f) => {
    const ws = vscode.workspace.getWorkspaceFolder(f.uri);
    const wsName = ws.name;
    const file = path.join(ws.uri.fsPath, '.gitignore');
    if (fs.existsSync(file)) {
      void globifyGitIgnoreFile(ws.uri.fsPath).then((globs) => {
        gitignores[wsName] = globs;
      });
    }
  });

  gitignoreWatcher = vscode.workspace.createFileSystemWatcher(
    '.gitignore',
    false,
    false,
    false
  );
  context.subscriptions.push(
    gitignoreWatcher.onDidChange((uri) => {
      const ws = vscode.workspace.getWorkspaceFolder(uri);
      const wsName = ws.name;
      const dirname = path.dirname(uri.fsPath);
      void globifyGitIgnoreFile(dirname).then((globs) => {
        gitignores[wsName] = globs;
      });
    })
  );
}
// this method is called when your extension is deactivated
// export function deactivate() {}
