# Sakuga

Draw TikZ figures in VS Code. Open a `.sakuga.tikz` file with the Sakuga custom editor.

The Figure tab holds sheet and figure settings; selecting an object opens Selection. The TikZ source drawer, inspector sections and Layers split remember their state. The white sheet is centred at TikZ x = 0; its width defaults to 146 mm. A different width is stored as `% sakuga sheet <mm>`. Red dashed outlines flag objects outside that width; export still crops to content.

Toolbar glyphs use Microsoft [Codicons](https://github.com/microsoft/vscode-codicons), bundled unchanged from npm `@vscode/codicons` distributed with the VS Code Hex Editor extension. Font and artwork: CC-BY-4.0 (`media/codicons-LICENSE.txt`); code: MIT (`media/codicons-LICENSE-CODE.txt`). Only the used CSS glyph declarations are included.
