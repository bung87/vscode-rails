import * as vscode from 'vscode';
import jsbeautify = require('js-beautify');

export function format(document: vscode.TextDocument, range: vscode.Range) {
  if (range === null) {
    const start = new vscode.Position(0, 0);
    const end = new vscode.Position(
      document.lineCount - 1,
      document.lineAt(document.lineCount - 1).text.length
    );
    range = new vscode.Range(start, end);
  }

  const result: vscode.TextEdit[] = [];

  const content = document.getText(range);

  const formatted = beatify(content, document.languageId);
  const isFormatted = !!formatted && formatted !== content;
  if (isFormatted) {
    result.push(new vscode.TextEdit(range, formatted));
  }

  return result;
}

function beatify(documentContent: string, languageId): string {
  let beatiFunc = null;

  switch (languageId) {
    case 'scss.erb':
      languageId = 'css';
      beatiFunc = jsbeautify.css;
    case 'css.erb':
      beatiFunc = jsbeautify.css;
      break;
    // case 'json':
    //     languageId = 'javascript';
    case 'js.erb':
      languageId = 'javascript';
      beatiFunc = jsbeautify.js;
      break;
    case 'html.erb':
      beatiFunc = jsbeautify.html;
      break;
    default:
      showMesage(
        'Sorry, this language is not supported. Only support Javascript, CSS and HTML.'
      );
      break;
  }
  if (!beatiFunc) return;
  let tabSize = null;
  const beutifyOptions = {};
  const prefix = languageId.split('.')[0];
  const config = vscode.workspace.getConfiguration('');
  try {
    tabSize = config[`[${prefix}`][`erb]`]['editor.tabSize'];
  } catch (e) {
    tabSize = vscode.workspace.getConfiguration('editor').get('tabSize');
  }
  if (tabSize != null) {
    (beutifyOptions as any).indent_size = tabSize;
  }

  return beatiFunc(documentContent, beutifyOptions);
}

export class Formatter {
  public beautify() {
    // Create as needed
    const window = vscode.window;
    let range;
    // Get the current text editor
    const activeEditor = window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    const document = activeEditor.document;

    if (range === null) {
      const start = new vscode.Position(0, 0);
      const end = new vscode.Position(
        document.lineCount - 1,
        document.lineAt(document.lineCount - 1).text.length
      );
      range = new vscode.Range(start, end);
    }

    // var result: vscode.TextEdit[] = [];

    const content = document.getText(range);

    const formatted = beatify(content, document.languageId);
    const isFormatted = !!formatted && formatted !== content;
    if (isFormatted) {
      return activeEditor.edit((editor) => {
        const start = new vscode.Position(0, 0);
        const end = new vscode.Position(
          document.lineCount - 1,
          document.lineAt(document.lineCount - 1).text.length
        );
        range = new vscode.Range(start, end);
        return editor.replace(range, formatted);
      });
    }
  }

  public registerBeautify(range) {
    // Create as needed
    const window = vscode.window;

    // Get the current text editor
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }
    const document = editor.document;

    return format(document, range);
  }

  public onSave(e: vscode.TextDocumentWillSaveEvent) {
    const { document } = e;

    const docType: string[] = ['css.erb', 'scss.erb', 'html.erb'];

    if (docType.indexOf(document.languageId) === -1) {
      return;
    }
    const prefix = document.languageId.split('.')[0];
    let onSave = false;
    const config = vscode.workspace.getConfiguration('', e.document);
    try {
      onSave = config[`[${prefix}`][`erb]`]['editor.formatOnSave'];
    } catch (e) {
      onSave = vscode.workspace.getConfiguration('editor').get('formatOnSave');
    }
    if (!onSave) {
      return;
    }

    const start = new vscode.Position(0, 0);
    const end = new vscode.Position(
      document.lineCount - 1,
      document.lineAt(document.lineCount - 1).text.length
    );
    let range = new vscode.Range(start, end);

    // var result: vscode.TextEdit[] = [];

    const content = document.getText(range);

    const formatted = beatify(content, document.languageId);
    const isFormatted = !!formatted && formatted !== content;
    if (isFormatted) {
      const start = new vscode.Position(0, 0);
      const end = new vscode.Position(
        document.lineCount - 1,
        document.lineAt(document.lineCount - 1).text.length
      );
      range = new vscode.Range(start, end);
      const edit = vscode.TextEdit.replace(range, formatted);
      e.waitUntil(Promise.resolve([edit]));
    }
  }
}

function showMesage(msg: string) {
  vscode.window.showInformationMessage(msg);
}
