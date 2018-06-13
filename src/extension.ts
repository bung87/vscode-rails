"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as path from "path";
import { dirname, join, basename } from "path";
import { RailsHelper } from "./rails_helper";
import { RailsDefinitionProvider } from "./railsDeclaration";
import { RailsCompletionItemProvider } from "./rails_completion";
import { ViewDefinitionProvider } from "./viewRef";
import lineByLine = require("n-readlines");

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

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("rails-nav", railsNavigation)
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

  vscode.workspace.findFiles("Gemfile").then((uris: vscode.Uri[]) => {
    if (uris.length == 1) {
      let fileAbsPath = uris[0].fsPath;
      var liner = new lineByLine(fileAbsPath),
        line;
      while ((line = liner.next())) {
        let lineText = line.toString("utf8").trim();
        if (/gem\s+['"]rails['"]/.test(lineText)) {
          console.log("Gemfile contains rails");
          registerViewDefinitionProvider();
          break;
        }

      }
    }
  });
}
// this method is called when your extension is deactivated
export function deactivate() {}
