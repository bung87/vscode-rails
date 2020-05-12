import { FileType } from './constants';

export interface RailsDefinitionInformation {
  file: string; // relative glob pattern
  line: number;
  fileType?: FileType;
  column: number;
  doc?: string;
  name?: string;
}
