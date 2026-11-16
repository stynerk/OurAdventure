// Validate local Markdown links without network requests or new dependencies.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const files = [...new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard'], {
  cwd: root, encoding: 'utf8',
}).trim().split(/\r?\n/))].filter(file => file.endsWith('.md') && fs.existsSync(path.join(root, file)));
const errors = [];
let checked = 0;
const stripCode = text => text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '');
const slugs = text => {
  const counts = new Map();
  return new Set([...stripCode(text).matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)].map(([, heading]) => {
    const slug = heading.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{M}\p{N}_\-\s]/gu, '').replace(/\s/g, '-');
    const count = counts.get(slug) || 0;
    counts.set(slug, count + 1);
    return slug + (count ? `-${count}` : '');
  }));
};

for (const file of files) {
  const text = stripCode(fs.readFileSync(path.join(root, file), 'utf8'));
  const links = [...text.matchAll(/\]\(<?([^\s)>]+)>?(?:\s+["'][^\n]*?["'])?\)/g)];
  links.push(...text.matchAll(/^\s*\[[^\]]+\]:\s*<?([^\s>]+)>?/gm));
  for (const match of links) {
    const url = match[1];
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) continue;
    const [target, fragment] = url.split('#');
    const resolved = target.startsWith('/')
      ? path.join(root, decodeURIComponent(target))
      : path.resolve(root, path.dirname(file), decodeURIComponent(target || path.basename(file)));
    checked++;
    if (!fs.existsSync(resolved)) {
      errors.push(`${file}: missing ${url}`);
    } else if (fragment && resolved.endsWith('.md')) {
      const content = fs.readFileSync(resolved, 'utf8');
      const decoded = decodeURIComponent(fragment);
      if (!slugs(content).has(decoded) && !content.includes(`id="${decoded}"`) && !content.includes(`name="${decoded}"`)) {
        errors.push(`${file}: missing anchor ${url}`);
      }
    }
  }
}
console.log(`Checked ${checked} local links in ${files.length} Markdown files; ${errors.length} broken links.`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
}
