"use strict";

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { RailsHelper } from "./rails_helper";
import { RailsDefinitionProvider } from "./rails_definition";
import { RailsCompletionItemProvider } from "./rails_completion";
import { ViewDefinitionProvider } from "./viewRef";
import lineByLine = require("n-readlines");
import { viewDoc } from "./view_doc";
import path = require('path');
import {Formatter} from './formatter';

const RAILS_MODE: vscode.DocumentFilter = { language: "ruby", scheme: "file" };
const VIEW_MODE: vscode.DocumentFilter = {
  pattern: "**/views/**",
  scheme: "file"
};
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function railsNavigation() {
  // The code you place here will be executed every time your command is executed

  // Display a message box to the user
  //vscode.window.showInformationMessage('Hello World!');
  if (!vscode.window.activeTextEditor) {
    return;
  }

  var relativeFileName = vscode.workspace.asRelativePath(
    vscode.window.activeTextEditor.document.fileName
  );

  var line = vscode.window.activeTextEditor.document
    .lineAt(vscode.window.activeTextEditor.selection.active.line)
    .text.trim();

  var rh = new RailsHelper(relativeFileName, line);
  rh.showFileList();
}

function registerFormatter(context: vscode.ExtensionContext){
  console.log("registerFormatter")
  var docType: Array<string> = ['css.erb', 'scss.erb',  'html.erb'];

  for (var i = 0, l = docType.length; i < l; i++) {
      registerDocType(docType[i]);
  }

  let formatter = new Formatter();

  context.subscriptions.push(vscode.commands.registerCommand('erb.formatting', () => {
      formatter.beautify();
  }));


  // context.subscriptions.push(vscode.commands.registerCommand('Lonefy.formatterConfig', () => {

  //     formatter.openConfig(
  //         path.join(vscode.workspace.rootPath || '.', '.vscode', 'formatter.json'),
  //         function () {
  //             vscode.window.showInformationMessage('[Local]  After editing the file, remember to Restart VScode');
  //         },
  //         function () {
  //             var fileName = path.join(__dirname, 'formatter.json');
  //             formatter.openConfig(
  //                 fileName,
  //                 function () {
  //                     vscode.window.showInformationMessage('[Golbal]  After editing the file, remember to Restart VScode');
  //                 },
  //                 function () {
  //                     vscode.window.showInformationMessage('Not found file: ' + fileName);
  //                 })
  //         })
  // }));


  // context.subscriptions.push(vscode.commands.registerCommand('Lonefy.formatterCreateLocalConfig', () => {
  //     formatter.generateLocalConfig();
  // }));

  context.subscriptions.push(vscode.workspace.onWillSaveTextDocument(e => {
      formatter.onSave(e)
  }));


  function registerDocType(type) {

      context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(type, {
          provideDocumentFormattingEdits: (document, options, token) => {
              return formatter.registerBeautify(null)
          }
      }));
      context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider(type, {
          provideDocumentRangeFormattingEdits: (document, range, options, token) => {
              var start = new vscode.Position(0, 0);
              var end = new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
              return formatter.registerBeautify(new vscode.Range(start, end))
          }
      }));
  }
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("Rails:Navigation", railsNavigation)
  );
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      RAILS_MODE,
      new RailsDefinitionProvider()
    )
  );
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { scheme: "file" },
      new RailsCompletionItemProvider(),
      ".",
      '"',
      ":",
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
      vscode.commands.registerCommand("Rails:Document", viewDoc, context)
    );
  }

  vscode.workspace.findFiles("Gemfile").then((uris: vscode.Uri[]) => {
    if (uris.length == 1) {
      let fileAbsPath = uris[0].fsPath;
      var liner = new lineByLine(fileAbsPath),
        line;
      while ((line = liner.next())) {
        let lineText = line.toString("utf8").trim();
        if (/gem\s+['"]rails['"]/.test(lineText)) {
          registerViewDefinitionProvider();
          registerViewDocCommand();
          registerFormatter(context);
          console.log("Project Gemfile contains rails");
          break;
        }
      }
    }
  });
}
// this method is called when your extension is deactivated
export function deactivate() {}
