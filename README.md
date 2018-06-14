# rails  

* Ruby on Rails "Asset Helpers" and "Tag Helpers" snippets.
* .erb syntax highlights.
* Navigation between related files through command.
* Go to Definition.
* View path suggestion 、Model's static method suggestion and Model's field suggestion.

## Features

![feature X](./images/vscode-rails.gif)

Navigation between related files.

![screenshot](./images/rails-nav.png)

## Default keybinding

* Alt + . (Alt + dot)
* Opt + . (Opt + dot Mac)

## Known Issues  

This extension is not fully implemented form_helpers of rails edge version ,exclude "select" families,"fields_for".
[Form Helpers](http://edgeguides.rubyonrails.org/form_helpers.html)

## Todo List for current stage  

Current stage of this extension,aims for using simple regular expression to implements intelligent completion 、"go to definition" and using glob pattern for file navigation in project source files.The lack of variable's and instance method call's definition and completion may implements in next stage.

Notice: Since I'm not a regex pro and rails pro these codes of current stage may needs improvement.will leave it to contributors until I really have plenty of free time.I will use mine free time to merge PRs if has any.

about testing: Manually testing in 2 exsits rails projects.

List sort by priority.

- [x] avoid rails's go to definition.
- [x] controller's filters、actions and helpers go to definition.
- [x] model's go to definition.
- [x] model's field suggestion.
- [x] file path suggestion in controller and views etc.
- [x] controller's go to definition seaching with parents.

## Todo List for next stage

The next stage of this extension will fill the lack of previews stage may implements a long running process for collection all symbols(module,class,method and etc) in gems for completion and "go to definition",detect ruby env and may interact with [vscode-ruby](https://github.com/rubyide/vscode-ruby) ,caching all completion and definition infomations.

List sort by priority.

- [ ] avoid ruby's std lib go to definition.
- [ ] seaching definition in gems.

## Contribution

This extension made by mine free time,contributions are welcome!

## Release Notes  

### 0.7.0

rails helper go to definition and view path definition in views.  

### 0.5.7  

Support view path definition in ruby files and fix view path definition.

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

-----------------------------------------------------------------------------------------------------------

**Enjoy!**