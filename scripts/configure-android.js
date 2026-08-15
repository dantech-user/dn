const fs = require('node:fs');
const path = require('node:path');

const manifestPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (!fs.existsSync(manifestPath)) throw new Error('AndroidManifest.xml não encontrado. Execute npx cap add android primeiro.');

let manifest = fs.readFileSync(manifestPath, 'utf8');
const additions = [
  '<uses-permission android:name="android.permission.NFC" />',
  '<uses-feature android:name="android.hardware.nfc" android:required="false" />'
];

for (const entry of additions) {
  const identity = entry.match(/android:name="([^"]+)"/)?.[1];
  if (identity && !manifest.includes(`android:name="${identity}"`)) {
    manifest = manifest.replace(/(<manifest[^>]*>)/, `$1\n    ${entry}`);
  }
}

fs.writeFileSync(manifestPath, manifest);
console.log('Android configurado com permissão NFC e fallback para aparelhos sem NFC.');
