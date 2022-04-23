'use strict';
import vscode from 'vscode';
import path, { posix, basename } from 'path';
import inflection from 'inflection2';
import { findFiles, dectFileType, flattenDeep } from '../utils';
import { Rails } from '../rails';
import { FileType } from '../rails/file';
import { SearchPatterns } from './search_pattern';

function searchPaths(filePattern: string , filter = (v:string) => true): string[] {
  const res: string[] = [];
  SearchPatterns.filter(filter).forEach((e) => {
    let p = e.replace('PTN', filePattern);
    p = p.replace(
      'BASENAME_SINGULARIZE',
      inflection.singularize(basename(filePattern))
    );
    p = p.replace('SINGULARIZE', inflection.singularize(filePattern));
    res.push(p);
  });
  return res;
}

function getFileOrPattern(
  relativeFileName: string,
  line?: string
): [string | null, string | null] {
  let filePattern: string | null = null;
  let targetFile: string | null = null;
  const parsed = path.parse(relativeFileName);
  const fileType = dectFileType(relativeFileName),
    prefix = relativeFileName.substring(
      Rails.FileType2Path.get(fileType).length + 1
    );
  switch (fileType) {
    case FileType.Controller:
      filePattern = posix.join(
        prefix,
        parsed.base.replace(/_controller\.rb$/, '')
      );
      if (line && /^def\s+/.test(line)) {
        filePattern = posix.join(filePattern, line.replace(/^def\s+/, ''));
      }
      break;
    case FileType.Model:
      {
        const name = parsed.base.replace(/\.rb$/, '');
        filePattern = posix.join(prefix, inflection.pluralize(name));
      }
      break;
    case FileType.Layout:
      filePattern = posix.join(prefix, parsed.base.replace(/\..*?\..*?$/, ''));
      break;
    case FileType.View:
      filePattern = prefix;
      break;
    case FileType.Helper:
      filePattern =
        prefix === '' && parsed.base === 'application_helper.rb'
          ? ''
          : posix.join(prefix, parsed.base.replace(/_helper\.rb$/, ''));
      break;
    case FileType.Javascript:
      filePattern = posix.join(
        prefix,
        parsed.base.replace(/\.js$/, '').replace(/\..*?\..*?$/, '')
      );
      break;
    case FileType.StyleSheet:
      filePattern = posix.join(
        prefix,
        parsed.base.replace(/\.css$/, '').replace(/\..*?\..*?$/, '')
      );
      break;
    case FileType.Rspec:
      targetFile = posix.join(
        'app',
        prefix,
        parsed.base.replace('_spec.rb', '.rb')
      );
      break;
    case FileType.Test:
      filePattern = posix.join(
        'app',
        prefix,
        parsed.base.replace('_test.rb', '.rb')
      );
      break;
  }
  return [targetFile, filePattern];
}

export class NavigationHelper {
  private filePattern: string;
  private relativePath: string;
  private targetFile: string;
  private document: vscode.TextDocument;
  public constructor(document: vscode.TextDocument, line?: string) {
    this.document = document;
    this.relativePath = vscode.workspace.asRelativePath(document.fileName);

    const [targetFile, filePattern] = getFileOrPattern(this.relativePath, line);
    this.targetFile = targetFile;
    this.filePattern = filePattern;
  }

  public async generateList(arr: string[]) {
    const ap = arr.map(async (cur) => {
      const res = await findFiles(this.document, cur, this.relativePath);
      return res;
    });
    const lists = await Promise.all(ap);
    return flattenDeep(lists);
  }

  public showQuickPick(items: vscode.Uri[]) {
    const rels = items.map((u) => vscode.workspace.asRelativePath(u));
    void vscode.window
      .showQuickPick(rels, {
        placeHolder: 'Select File',
        matchOnDetail: true,
      })
      .then((value) => {
        if (!value) return;
        const file = items.find(
          (u) => vscode.workspace.asRelativePath(u) === value
        );
        void vscode.workspace.openTextDocument(file).then((doc) => {
          return vscode.window.showTextDocument(doc);
        });
      });
  }

  public async relatedFiles(filter = (v:string) => true): Promise<vscode.Uri[]>{
    if (this.filePattern != null) {
      const paths = searchPaths(this.filePattern, filter).slice();
      return this.generateList(paths)
    }
    return []
  }

  public showFileList() {
    if (this.filePattern != null) {
      const paths = searchPaths(this.filePattern).slice();
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
