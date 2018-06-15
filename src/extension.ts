"use strict";
/// <reference path="./vs/vscode.proposed.d.ts" />
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
import is = require("is_js");
import rp = require("request-promise-native");
import { RAILS } from "./rails";

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
// Track currently webview panel
var currentPanel: vscode.WebviewPanel | undefined = undefined;
function injectBase(html, base) {
  let _base = path.dirname(base);
  // Remove any <base> elements inside <head>
  html = html.replace(
    /(<[^>/]*head[^>]*>)[\s\S]*?(<[^>/]*base[^>]*>)[\s\S]*?(<[^>]*head[^>]*>)/gim,
    "$1 $3"
  );

  // Add <base> just before </head>
  html = html.replace(
    /(<[^>/]*head[^>]*>[\s\S]*?)(<[^>]*head[^>]*>)/gim,
    `$1 <base href="${_base}"> $2`
  );
  return html;
}
function viewDoc() {
  let context = this;
  let document = vscode.window.activeTextEditor.document;
  let position = vscode.window.activeTextEditor.selection.active;
  let wordRange = document.getWordRangeAtPosition(position);
  let word = document.getText(wordRange);
  let lineStartToWord = document.getText(new vscode.Range(new vscode.Position(position.line, 0), wordRange.end)).trim();
  let symbol = new RegExp("(((::)?[A-Za-z]+)*(::)?" + word + ")").exec(lineStartToWord)[1];
  console.log(`symbol:${symbol}`);
  var endpoint = null;
  if (symbol && RAILS.has(symbol.toLowerCase())) {
		endpoint = symbol.replace("::","/");
	}
  console.log(`endpoint:${endpoint}`);
  if(endpoint == null){
    return;
  }
  let url = `http://api.rubyonrails.org/classes/${endpoint}.html`;
  let request = rp(url)
    .then(function(htmlString) {
      const columnToShowIn = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;
      if (currentPanel) {
        // If we already have a panel, show it in the target column
        currentPanel.reveal(columnToShowIn);
      } else {
        currentPanel = vscode.window.createWebviewPanel(
          "catCoding",
          "Cat Coding",
          vscode.ViewColumn.Two,
          {
            // Enable scripts in the webview
            enableScripts: true
          }
        );
        let html = injectBase(htmlString, url);
        console.log(html);
        currentPanel.webview.html = html;
        // Reset when the current panel is closed
        currentPanel.onDidDispose(
          () => {
            currentPanel = undefined;
            request.abort();
          },
          null,
          context.subscriptions
        );
      }
    })
    .catch(function(err) {
      // Crawling failed...
      console.log(err);
    });
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
          console.log("Gemfile contains rails");
          registerViewDefinitionProvider();
          registerViewDocCommand();

          break;
        }
      }
    }
  });
}
// this method is called when your extension is deactivated
export function deactivate() {}
