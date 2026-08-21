// Writes the built version into out/version.json, so a running browser can ask
// the server which push is current and compare it with the one it is running.
//
// Read out of src/lib/version.ts rather than kept alongside it, because two
// copies of a version string is one copy too many.
import { readFileSync, writeFileSync } from 'node:fs';

const source = readFileSync('src/lib/version.ts', 'utf8');
const version = source.match(/VERSION = '([^']+)'/)?.[1];

if (!version) {
  console.error('No VERSION found in src/lib/version.ts - nothing to publish.');
  process.exit(1);
}

writeFileSync('out/version.json', `${JSON.stringify({ version })}\n`);
console.log(`out/version.json -> ${version}`);
