## Release Notes
### 0.16.5  
* `require` to `import`, commented unused imports
* use `terser` for compress beauty and `drop_console`
* update engines dep `"node": ">=7.10.1"` that suport `async`,`await` keyword. ts compiles to `exnext`.  


### 0.16.4 
* bug fix: provideDefinition position.character(column) should be number  otherwise raise "Invalid arguments"  
* remove `n-readlines`, using Built-in `readline` module  
* bug fix: find partial view in jbuilder template
* make some functions async
### 0.8.0  

* Developed [vscode-gemfile](https://marketplace.visualstudio.com/items?itemName=bung87.vscode-gemfile) as extension dependency.

* snippets supports Slim templates as well as erb

* move the cursor to a symbol(support Rails and Ruby,Gems not support),and <kbd>alt+F1</kbd> show online document to side.

### 0.7.0

rails helper go to definition and view path definition in views.

### 0.5.7

Support view path definition and sugestion in ruby files and fix view path definition.

### 0.5.6

avoid rails's go to definition.

### 0.5.5

Support active record query suggestion.

### 0.5.4

Resolving unkown type of file and unkown pattern

### 0.5.3

Enhance controller‘s concerns、views、lib and models definition

### 0.5.0

Implementing controller‘s concerns、views、lib and models definition

### 0.4.0

Improving file search and complete spec and test file type.

### 0.3.0

Rails navigation taken from [https://github.com/hjleochen/vscode-rails-nav](https://github.com/hjleochen/vscode-rails-nav)

### 0.2.0

Taken grammers from [https://github.com/craigmaslowski/vscode-erb](https://github.com/craigmaslowski/vscode-erb)

### 0.1.0

Initial release of vscode-rails
