export const PATTERNS = {
  CLASS_INHERIT_DECLARATION: /^class\s+[^<]+<\s+/,
  FUNCTION_DECLARATON: /^def\s+/,
  INCLUDE_DECLARATION: /^include\s+/,
  CAPITALIZED: /^[A-Z](?=[a-z])/,
  PARAMS_DECLARATION: /_params$/,
  LAYOUT_DECLARATION: /^layout\s+/,
  LAYOUT_MATCH: /^layout\s+(['":]?([A-Za-z\/0-9_]+)['"]?)/,
  RENDER_DECLARATION: /render[\(\s]/,
  RENDER_TO_STRING_DECLARATION: /render_to_string[\(\s]/,
  RENDER_MATCH: /([A-Za-z\/0-9_-]+(\.[A-Za-z0-9]+)*)/g,
  MODEL_RELATIONS: /^has_one|^has_many|^has_and_belongs_to_many|^belongs_to/,
  CONTROLLER_FILTERS: /^(skip_|prepend_)?(before|after|around)_(action|filter)/,
  HELPER_METHODS: /^helper_method/,
  CLASS_STATIC_METHOD_CALL: /(([A-Z][A-Za-z]+)\.[^\)]*)/,
};

export const VIEWS_PATTERNS = {
  RENDER_PATTERN: /render/,
  RENDER_FUNC_PATTERN: /(escape_javascript|j)?[\s\(]render([\s\(]:([a-z]+)\s*=>\s*)?(["'])([^\4]+)\4/,
  RENDER_FUNC_PATTERN2: /(escape_javascript|j)?[\s\(]render([\s\(]([a-z]+):\s*)?(["'])([^\4]+)\4/,
};
