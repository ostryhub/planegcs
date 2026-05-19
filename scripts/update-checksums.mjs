import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distRoot = join(repoRoot, 'planegcs_dist');
const artifacts = ['planegcs.wasm', 'planegcs.js'];

const checksumLines = artifacts.map((artifactName) => {
  const artifactPath = join(distRoot, artifactName);
  if (!existsSync(artifactPath)) {
    throw new Error(`Cannot checksum missing artifact: planegcs_dist/${artifactName}`);
  }
  const hash = createHash('sha256').update(readFileSync(artifactPath)).digest('hex');
  return `${hash}  ${artifactName}`;
});

writeFileSync(join(distRoot, 'CHECKSUMS.txt'), `${checksumLines.join('\n')}\n`);
