import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const distAssetsDir = join(process.cwd(), 'dist', 'assets');

const maxSingleBytes = Number(process.env.BUNDLE_MAX_SINGLE_BYTES || 450000);
const maxTotalBytes = Number(process.env.BUNDLE_MAX_TOTAL_BYTES || 2500000);

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function listJsAssets(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => {
      const filePath = join(dir, name);
      const size = statSync(filePath).size;
      return { name, size };
    })
    .sort((a, b) => b.size - a.size);
}

try {
  const assets = listJsAssets(distAssetsDir);

  if (assets.length === 0) {
    console.error('No JS assets found under dist/assets. Run build before bundle check.');
    process.exit(1);
  }

  const largest = assets[0];
  const total = assets.reduce((sum, a) => sum + a.size, 0);

  console.log('Bundle Size Check');
  console.log(`- Largest JS chunk: ${largest.name} (${formatBytes(largest.size)})`);
  console.log(`- Total JS size: ${formatBytes(total)}`);
  console.log(`- Limits: single <= ${formatBytes(maxSingleBytes)}, total <= ${formatBytes(maxTotalBytes)}`);

  const violations = [];
  if (largest.size > maxSingleBytes) {
    violations.push(`Largest chunk exceeds limit: ${largest.name} (${formatBytes(largest.size)}) > ${formatBytes(maxSingleBytes)}`);
  }
  if (total > maxTotalBytes) {
    violations.push(`Total JS exceeds limit: ${formatBytes(total)} > ${formatBytes(maxTotalBytes)}`);
  }

  if (violations.length > 0) {
    console.error('\nBundle check failed:');
    for (const message of violations) {
      console.error(`- ${message}`);
    }
    process.exit(1);
  }

  console.log('Bundle check passed.');
} catch (error) {
  console.error(`Bundle check error: ${error.message}`);
  process.exit(1);
}
