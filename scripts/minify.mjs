import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '..', 'src');
const distDir = path.resolve(__dirname, '..', 'dist');

const start = Date.now();

// Clean dist
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

// Copy static assets
const staticDirs = ['fonts'];
for (const dir of staticDirs) {
  const src = path.join(srcDir, dir);
  if (fs.existsSync(src)) {
    fs.cpSync(src, path.join(distDir, dir), { recursive: true });
  }
}

// Copy fa-local.css as-is (needed for font-face)
fs.cpSync(path.join(srcDir, 'fa-local.css'), path.join(distDir, 'fa-local.css'));

// Minify JS
const jsFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.js'));
for (const file of jsFiles) {
  await esbuild.build({
    entryPoints: [path.join(srcDir, file)],
    outfile: path.join(distDir, file),
    minify: true,
    allowOverwrite: true,
  });
}

// Minify CSS
const cssFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.css'));
for (const file of cssFiles) {
  if (file === 'fa-local.css') continue;
  const result = await esbuild.build({
    entryPoints: [path.join(srcDir, file)],
    outfile: path.join(distDir, file),
    minify: true,
    allowOverwrite: true,
  });
}

// Minify HTML
const html = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf-8');
let minified = html
  .replace(/>\s+</g, '><')
  .replace(/>\s{2,}/g, '>')
  .replace(/\s{2,}</g, '<')
  .replace(/\s{2,}/g, ' ')
  .replace(/\s+\/>/g, '/>')
  .trim();
fs.writeFileSync(path.join(distDir, 'index.html'), minified);

console.log(`Minified ${jsFiles.length} JS + ${cssFiles.length} CSS + HTML in ${Date.now() - start}ms`);
