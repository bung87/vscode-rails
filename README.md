# Rails

[![Join the chat at https://gitter.im/vscode-rails/Lobby](https://badges.gitter.im/vscode-rails/Lobby.svg)](https://gitter.im/vscode-rails/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) 
[![](https://vsmarketplacebadge.apphb.com/version/bung87.rails.svg
)](https://marketplace.visualstudio.com/items?itemName=bung87.rails)
[![](https://vsmarketplacebadge.apphb.com/installs-short/bung87.rails.svg
)](https://marketplace.visualstudio.com/items?itemName=bung87.rails)
[![](https://vsmarketplacebadge.apphb.com/rating-short/bung87.rails.svg
)](https://marketplace.visualstudio.com/items?itemName=bung87.rails)
[![](https://vsmarketplacebadge.apphb.com/trending-monthly/bung87.rails.svg
)](https://marketplace.visualstudio.com/items?itemName=bung87.rails)


Ruby on Rails support for Visual Studio Code

Notice: In order for this extension to work, you must  
- Open vscode at the root folder of your project. 
- Have a `Gemfile` containing `gem rails`, at your project root.

## Features

- Ruby on Rails "Asset Helpers" and "Tag Helpers" snippets.
- `.erb` syntax highlighting.
- Navigation between related files through command.
- _Go to Definition_.
- View path, Model's static method and Model's field suggestions.
- Open online document to the side through command.

#### [Snippets](snippets)

![feature X](./images/vscode-rails.gif)

#### Navigation between related files.

![screenshot](./images/rails-nav.png)

## Default keybinding

### Navigation

- <kbd>Alt + .</kbd>
- <kbd>Opt + .</kbd> (on Mac)

### Open online document to the side

- <kbd>Alt + F1</kbd>
- <kbd>Opt + F1</kbd> (on Mac)

## Configuration  
formatOnSave:  

`rails.editor.formatOnSave` and `rails.editor.[html.erb].formatOnSave`, `rails.editor.[css.erb].formatOnSave`, `rails.editor.[scss.erb].formatOnSave`

## Known Issues

The extension is not fully implemented form_helpers of rails edge version, exclude "select" families, "fields_for".
[Form Helpers](http://edgeguides.rubyonrails.org/form_helpers.html)

## TODO

- [ ] collect most popular rails version symbols instead of just one version  
- [ ] performance  
## Donate  

[paypal](https://paypal.me/bung87)  

[![buy me a coffee](https://img.shields.io/badge/donate-buy%20me%20a%20coffee-orange.svg)](https://www.buymeacoffee.com/d4v36nCg1)  

## Contribution

This extension is made by me during my free time. Contributions are welcome!

---

**Enjoy!**
