import { dirname, join, sep, basename } from 'path';
import { FileType, FileTypeRelPath } from "./constants"


export function dectFileType(filePath: string): FileType {
    for (var [key, value] of FileTypeRelPath) {
        if (filePath.indexOf(value + sep) >= 0) {
            console.log(key)
            return key
        }
    }
    return FileType.Unkown
}