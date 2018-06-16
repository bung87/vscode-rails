# rails

[![Join the chat at https://gitter.im/vscode-rails/Lobby](https://badges.gitter.im/vscode-rails/Lobby.svg)](https://gitter.im/vscode-rails/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

## Features

- Ruby on Rails "Asset Helpers" and "Tag Helpers" snippets.
- .erb syntax highlights.
- Navigation between related files through command.
- Go to Definition.
- View path suggestion 、Model's static method suggestion and Model's field suggestion.
- Open online document to the side through command.

#### [Snippets](snippets)

![feature X](./images/vscode-rails.gif)

#### Navigation between related files.

![screenshot](./images/rails-nav.png)

## Default keybinding

### Navigation

- Alt + . (Alt + dot)
- Opt + . (Opt + dot Mac)

### Open online document to the side

- Alt + . (Alt + F1)
- Opt + . (Opt + F1 Mac)

## Known Issues

This extension is not fully implemented form_helpers of rails edge version ,exclude "select" families,"fields_for".
[Form Helpers](http://edgeguides.rubyonrails.org/form_helpers.html)

## Development

### About current stage

Current stage of this extension,aims for using simple regular expression to implements intelligent completion 、"go to definition" and using glob pattern for file navigation in project source files.The lack of variable's and instance method call's definition and completion may implements in next stage.

Notice: Since I'm not a regex pro and rails pro these codes of current stage may needs improvement.will leave it to contributors until I really have plenty of free time.I will use mine free time to merge PRs if has any.

about testing: Manually testing in 2 exsits rails projects.

### Todo List for next stage

The next stage of this extension will fill the lack of previews stage may implements a long running process for collection all symbols(module,class,method and etc) in gems for completion and "go to definition",detect ruby env and may interact with [vscode-ruby](https://github.com/rubyide/vscode-ruby) ,caching all completion and definition infomations.

List sort by priority.

- [ ] avoid ruby's std lib go to definition.
- [ ] seaching definition in gems.

## Contribution

This extension made by mine free time,contributions are welcome!

---

**Enjoy!**
