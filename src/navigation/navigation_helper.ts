'use strict';
import vscode from 'vscode';
import { dirname, join, basename } from 'path';
import inflection from 'inflection2';
import { findFiles, dectFileType, flattenDeep } from '../utils';
import { Rails } from '../rails';
import { FileType } from '../rails/file';
import { SearchPatterns } from './search_pattern';

export class NavigationHelper {
  private fileName: string;
  private filePatten: string;
  private relativeFileName: string;
  private line: string; // @TODO detect by current line
  private targetFile: string;
  private document: vscode.TextDocument;
  public constructor(
    document: vscode.TextDocument,
    line?: string
  ) {
    this.document = document;
    const relativeFileName = vscode.workspace.asRelativePath(
      document.fileName
    )
    this.relativeFileName = relativeFileName;
    this.fileName = basename(relativeFileName);
    const filePath = dirname(relativeFileName);
    this.line = line;
    this.initPatten(filePath);
  }

  public searchPaths(): string[] {
    const res: string[] = [];
    SearchPatterns.forEach((e) => {
      let p = e.replace('PTN', this.filePatten.toString());
      p = p.replace(
        'BASENAME_SINGULARIZE',
        inflection.singularize(basename(this.filePatten.toString()))
      );
      p = p.replace(
        'SINGULARIZE',
        inflection.singularize(this.filePatten.toString())
      );
      res.push(p);
    });
    return res;
  }
  private initPatten(filePath: string) {
    this.filePatten = null;
    this.targetFile = null;
    const fileType = dectFileType(filePath),
      prefix = filePath.substring(Rails.FileType2Path.get(fileType).length + 1);
    switch (fileType) {
      case FileType.Controller:
        this.filePatten = join(
          prefix,
          this.fileName.replace(/_controller\.rb$/, '')
        );
        if (this.line && /^def\s+/.test(this.line)) {
          this.filePatten = join(
            this.filePatten,
            this.line.replace(/^def\s+/, '')
          );
        }
        break;
      case FileType.Model:
        {
          const filePatten = join(prefix, this.fileName.replace(/\.rb$/, ''));
          this.filePatten = inflection.pluralize(filePatten.toString());
        }
        break;
      case FileType.Layout:
        this.filePatten = join(
          prefix,
          this.fileName.replace(/\..*?\..*?$/, '')
        );
        break;
      case FileType.View:
        this.filePatten = prefix;
        break;
      case FileType.Helper:
        this.filePatten =
          prefix === '' && this.fileName === 'application_helper.rb'
            ? ''
            : join(prefix, this.fileName.replace(/_helper\.rb$/, ''));
        break;
      case FileType.Javascript:
        this.filePatten = join(
          prefix,
          this.fileName.replace(/\.js$/, '').replace(/\..*?\..*?$/, '')
        );
        break;
      case FileType.StyleSheet:
        this.filePatten = join(
          prefix,
          this.fileName.replace(/\.css$/, '').replace(/\..*?\..*?$/, '')
        );
        break;
      case FileType.Rspec:
        this.targetFile = join(
          'app',
          prefix,
          this.fileName.replace('_spec.rb', '.rb')
        );
        break;
      case FileType.Test:
        this.filePatten = join(
          'app',
          prefix,
          this.fileName.replace('_test.rb', '.rb')
        );
        break;
    }
  }

  public async generateList(arr: string[]) {
    const ap = arr.map(async (cur) => {
      const res = await findFiles(this.document, cur, null);
      return res
        .map((i) => {
          return vscode.workspace.asRelativePath(i);
        })
        .filter((v) => this.relativeFileName !== v);
    });
    const lists = await Promise.all(ap);
    return flattenDeep(lists);
  }

  public showQuickPick(items: string[] | Thenable<string[]>) {
    void vscode.window.showQuickPick(items, {
      placeHolder: 'Select File',
      matchOnDetail: true,
    }).then((value) => {
      if (!value) return;
      const rootPath = vscode.workspace.getWorkspaceFolder(this.document.uri)
        .uri.path;

      const fn = vscode.Uri.file(join(rootPath, value));
      void vscode.workspace.openTextDocument(fn).then((doc) => {
        return vscode.window.showTextDocument(doc);
      });
    });
  }

  public showFileList() {
    if (this.filePatten != null) {
      const paths = this.searchPaths().slice();
      void this.generateList(paths).then((v) => {
        this.showQuickPick(v);
      });
    } else if (this.targetFile != null) {
      void this.generateList([this.targetFile]).then((v) => {
        this.showQuickPick(v);
      });
    }
  }
}
