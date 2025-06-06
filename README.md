# my-vscode-extensions

Hey there! 👋

I've gathered a list of my favorite and most-used VSCode extensions to boost your productivity, code quality, and just make working in the editor more enjoyable. Whether you're into Python, web development, or DevOps, there's probably something useful in here for you.

You can install them easily using one of the options below. ⬇️

## Installation options

### 🧩 Option 1: Install from `.vscode/extensions.json`

If you're opening this repository in VSCode, you'll get a prompt (in the left bottom corner) to install the recommended extensions automatically.

Else, install them manually with:

```bash
jq -r '.recommendations[]' .vscode/extensions.json | xargs -n 1 code --install-extension
```

### 📄 Option 2: Install from `extensions.txt`

You can also install from the plain text file:

```bash
xargs -n 1 code --install-extension < extensions.txt
```

## Share your own VSCode extensions

If you have a collection of VSCode extensions that you find useful, feel free to share them!

You can create a pull request to add your own list to this repository. Just follow the format used in the existing files. This [Python script](export_extensions.py) can be used to generate your list in either format `json` or `txt`. Just run it with the `--mode` option to specify the format you want. See:

```bash
python export_extensions.py --help
```

## Credit

If you found this helpful, feel free to ⭐ it and give credit by linking back here!
