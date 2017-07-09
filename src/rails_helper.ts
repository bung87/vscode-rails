'use strict';
import * as vscode from 'vscode';
import { dirname, join, basename } from 'path';

var inflection = require('inflection');

enum FileType {
    Controller = 1,
    Model,
    Layout,
    View,
    Helper,
    Javascript,
    StyleSheet,
    Rspec,
    Test
}

export class RailsHelper {
    private fileName: string;
    private filePath: string;
    private fileType: FileType;
    private filePatten: string;
    private relativeFileName;

    public constructor(file_path: string, file_name: string ,relativeFileName) {
        this.relativeFileName = relativeFileName;
        this.fileName = file_name;
        this.filePath = join(file_path, "/");
        this.dectFileType();
    }

/*
    private paths = [
        "app/controllers",
        "app/models",
        "app/views",
        "app/views/layouts",
        "app/helpers",
        "app/assets/javascripts",
        "app/assets/stylesheets",
    ];
*/

    private patterns = [
        "app/controllers/PTN*",
        "app/models/SINGULARIZE*",
        "app/views/PTN/**",
        "app/views/layouts/PTN*",
        "app/helpers/PTN*",
        "app/assets/javascripts/PTN*",
        "app/assets/javascripts/PTN/**",
        "app/assets/stylesheets/PTN*",
        "app/assets/stylesheets/PTN/**",
    ]

    public searchPaths() {
        var res = [];
        this.patterns.forEach(e => {
            var p = e.replace("PTN", this.filePatten.toString());
            p = p.replace("SINGULARIZE", inflection.singularize(this.filePatten.toString()));
            res.push(p);
        });
        return res;
    }
    private dectFileType() {
        this.filePatten = null;

        if (this.filePath.indexOf("app/controllers/") >= 0) {
            this.fileType = FileType.Controller
            this.filePatten = this.fileName.replace(/_controller\.rb$/, "");
        } else if (this.filePath.indexOf("app/models/") >= 0) {
            this.fileType = FileType.Model
            this.filePatten = this.fileName.replace(/\.rb$/, "");
            //DONE pluralize
            this.filePatten = inflection.pluralize(this.filePatten.toString())
        } else if (this.filePath.indexOf("app/views/layouts/") >= 0) {
            this.fileType = FileType.Layout
            this.filePatten = this.fileName.replace(/\..*?\..*?$/, "");
        } else if (this.filePath.indexOf("app/views/") >= 0) {
            this.fileType = FileType.View
            this.filePatten = this.filePath.replace("app/views/", '').replace(/\/$/, '');
        } else if (this.filePath.indexOf("app/helpers/") >= 0) {
            this.fileType = FileType.Helper
            this.filePatten = this.fileName.replace(/_helper\.rb$/, "");
        } else if (this.filePath.indexOf("app/assets/javascripts/") >= 0) {
            this.fileType = FileType.Javascript
            this.filePatten = this.fileName.replace(/\.js$/, "").replace(/\..*?\..*?$/, "");
        } else if (this.filePath.indexOf("app/assets/stylesheets/") >= 0) {
            this.fileType = FileType.StyleSheet
            this.filePatten = this.fileName.replace(/\.css$/, "").replace(/\..*?\..*?$/, "");
        } else if (this.filePath.indexOf("/spec/") >= 0) {
            this.fileType = FileType.Rspec
            //TODO
            this.filePatten = null;
        } else if (this.filePath.indexOf("/test/") >= 0) {
            this.fileType = FileType.Test
            //TODO
            this.filePatten = null;
        }
    }

    public items = [];
    private generateList(arr: Array<String>) {
        var cur = arr.pop();

        var _self = this;
        vscode.workspace.findFiles(cur.toString(),null).then((res) => {
            res.forEach(i => {
                var fn = vscode.workspace.asRelativePath(i);
                //var pic = { label: fn, detail: "c: ${fn}" };
                console.log(fn,_self.relativeFileName)
                if(_self.relativeFileName !== fn)
                _self.items.push(fn);
            });
            if (arr.length > 0) {
                _self.generateList(arr);
            } else {

                this.showQuickPick(_self.items);
            }
        });

    }

    public showQuickPick(items: any) {
        const p = vscode.window.showQuickPick(items, { placeHolder: "Select File", matchOnDetail: true });
        p.then(value => {
            if(!value) return;
            const fn = vscode.Uri.parse('file://' + join(vscode.workspace.rootPath, value));
            vscode.workspace.openTextDocument(fn).then(doc => {
                return vscode.window.showTextDocument(doc);
            });
        })
    }

    public showFileList() {
        if (this.filePatten != null) {
            var paths = this.searchPaths().slice();
            this.generateList(paths)
        }
    }
}