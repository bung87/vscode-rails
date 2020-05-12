'use strict';
import * as vscode from 'vscode';
import { dirname, join, sep, basename } from 'path';
import * as utils from './utils';
import {
  FileType,
  FileTypeRelPath,
  REL_CONTROLLERS,
  REL_MODELS,
  REL_VIEWS,
  REL_LAYOUTS,
  REL_HELPERS,
  REL_JAVASCRIPTS,
  REL_STYLESHEETS,
} from './constants';
import inflection = require('inflection');

export class RailsHelper {
  private fileName: string;
  private filePatten: string;
  private relativeFileName;
  private line: string; // @TODO detect by current line
  private targetFile: string;

  public constructor(relativeFileName: string, line: string) {
    this.relativeFileName = relativeFileName;
    this.fileName = basename(relativeFileName);
    const filePath = dirname(relativeFileName);
    this.line = line;
    this.initPatten(filePath);
  }

  private patterns = [
    join(REL_CONTROLLERS, 'PTN', '*'),
    join(REL_CONTROLLERS, 'PTN*'),
    join(REL_MODELS, 'SINGULARIZE', '*'),
    join(REL_MODELS, 'SINGULARIZE*'),

    join(REL_MODELS, 'BASENAME_SINGULARIZE', '*'),
    join(REL_MODELS, 'BASENAME_SINGULARIZE*'),

    join(REL_VIEWS, 'PTN', '*'),
    join(REL_VIEWS, 'PTN*'),

    join(REL_LAYOUTS, 'PTN', '*'),
    join(REL_LAYOUTS, 'PTN*'),

    join(REL_HELPERS, 'PTN', '*'),
    join(REL_HELPERS, 'PTN*'),

    join(REL_JAVASCRIPTS, 'PTN', '*'),
    join(REL_JAVASCRIPTS, 'PTN*'),

    join(REL_STYLESHEETS, 'PTN', '*'),
    join(REL_STYLESHEETS, 'PTN*'),
  ];

  public searchPaths() {
    const res = [];
    this.patterns.forEach((e) => {
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
  private initPatten(filePath) {
    this.filePatten = null;
    this.targetFile = null;
    const fileType = utils.dectFileType(filePath),
      prefix = filePath.substring(FileTypeRelPath.get(fileType).length + 1);
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
        const filePatten = join(prefix, this.fileName.replace(/\.rb$/, ''));
        this.filePatten = inflection.pluralize(this.filePatten.toString());
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

  public generateList(arr: string[]) {
    const ap = arr.map(async (cur) => {
      const res = await vscode.workspace.findFiles(cur.toString(), null);
      return res
        .map((i) => {
          return vscode.workspace.asRelativePath(i);
        })
        .filter((v) => this.relativeFileName !== v);
    });
    return Promise.all(ap).then((lists) => {
      return utils.flatten(lists);
    });
  }

  public showQuickPick(items: any) {
    const p = vscode.window.showQuickPick(items, {
      placeHolder: 'Select File',
      matchOnDetail: true,
    });
    p.then((value) => {
      if (!value) return;
      const fn = vscode.Uri.parse(
        'file://' + join(vscode.workspace.rootPath, value)
      );
      vscode.workspace.openTextDocument(fn).then((doc) => {
        return vscode.window.showTextDocument(doc);
      });
    });
  }

  public showFileList() {
    if (this.filePatten != null) {
      const paths = this.searchPaths().slice();
      this.generateList(paths).then((v) => {
        this.showQuickPick(v);
      });
    } else if (this.targetFile != null) {
      this.generateList([this.targetFile]).then((v) => {
        this.showQuickPick(v);
      });
    }
  }
}
