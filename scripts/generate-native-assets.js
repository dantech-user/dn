const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const assets = path.join(root, 'assets');
const publicAssets = path.join(root, 'public', 'assets');
const required = ['logo.svg', 'icon-only.svg', 'icon-foreground.svg', 'icon-background.svg', 'splash.svg', 'icon-only.png', 'icon-foreground.png', 'icon-background.png', 'splash.png', 'splash-dark.png'];

for (const file of required) {
  if (!fs.existsSync(path.join(assets, file))) throw new Error(`Asset obrigatório ausente: assets/${file}`);
}

fs.mkdirSync(publicAssets, { recursive: true });
fs.copyFileSync(path.join(assets, 'icon-only.png'), path.join(publicAssets, 'app-icon.png'));
console.log('Logo oficial conferida e assets nativos preparados.');
