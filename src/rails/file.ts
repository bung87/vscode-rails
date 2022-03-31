import {
  Controllers,
  ControllersConcerns,
  Helpers,
  Javascripts,
  Layouts,
  Models,
  ModelsConcerns,
  Spec,
  Stylesheets,
  Test,
  Views,
} from './path';

export enum FileType {
  Controller,
  ControllerConcerns,
  Model,
  ModelConcerns,
  Layout,
  View,
  Helper,
  Javascript,
  StyleSheet,
  Rspec,
  Test,
  Unkown,
}

export const FileType2Path = new Map([
  [FileType.Controller, Controllers],
  [FileType.ControllerConcerns, ControllersConcerns],
  [FileType.Model, Models],
  [FileType.ModelConcerns, ModelsConcerns],
  [FileType.Layout, Layouts],
  [FileType.View, Views],
  [FileType.Helper, Helpers],
  [FileType.Javascript, Javascripts],
  [FileType.StyleSheet, Stylesheets],
  [FileType.Rspec, Spec],
  [FileType.Test, Test],
]);

export function dectFileType(filePath: string): FileType {
  for (const [key, value] of FileType2Path) {
    if (filePath.indexOf(value) >= 0) {
      return key;
    }
  }
  return FileType.Unkown;
}
