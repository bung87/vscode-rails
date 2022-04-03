import { posix } from 'path';
import { Rails } from '../rails';
export const SearchPatterns = [
  posix.join(Rails.Controllers, 'PTN', '*'),
  posix.join(Rails.Controllers, 'PTN*'),
  posix.join(Rails.Models, 'SINGULARIZE', '*'),
  posix.join(Rails.Models, 'SINGULARIZE*'),

  posix.join(Rails.Models, 'BASENAME_SINGULARIZE', '*'),
  posix.join(Rails.Models, 'BASENAME_SINGULARIZE*'),

  posix.join(Rails.Views, 'PTN', '*'),
  posix.join(Rails.Views, 'PTN*'),

  posix.join(Rails.Layouts, 'PTN', '*'),
  posix.join(Rails.Layouts, 'PTN*'),

  posix.join(Rails.Helpers, 'PTN', '*'),
  posix.join(Rails.Helpers, 'PTN*'),

  posix.join(Rails.Javascripts, 'PTN', '*'),
  posix.join(Rails.Javascripts, 'PTN*'),

  posix.join(Rails.Stylesheets, 'PTN', '*'),
  posix.join(Rails.Stylesheets, 'PTN*'),
];
