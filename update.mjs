#!/usr/bin/env node
/**
 * 每天跑一次：把 apps.json 里每个 App 的下载信息刷新成最新 release 的。
 * 只认 GitHub 上的 release 资产，别的地址原样保留。
 */
import fs from 'node:fs';

const token = process.env.GITHUB_TOKEN;
const H = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'ipa-source-bot',
  'X-GitHub-Api-Version': '2022-11-28',
};

const file = 'apps.json';
const source = JSON.parse(fs.readFileSync(file, 'utf8'));
let changed = false;

for (const app of source.apps ?? []) {
  for (const v of app.versions ?? []) {
    const m = v.downloadURL?.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/download\/([^/]+)\/(.+)$/);
    if (!m) continue;
    const [, owner, repo, tag, assetName] = m;

    const rel = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`, { headers: H });
    if (!rel.ok) {
      console.log(`${app.name}: 拿不到 release ${tag} (${rel.status})`);
      continue;
    }
    const data = await rel.json();
    const asset = (data.assets ?? []).find(a => a.name === assetName);
    if (!asset) {
      console.log(`${app.name}: release 里没有 ${assetName}`);
      continue;
    }

    const date = (data.published_at ?? '').slice(0, 10);
    const size = asset.size;
    if (v.size !== size || v.date !== date) {
      console.log(`${app.name}: ${v.size} → ${size}, ${v.date} → ${date}`);
      v.size = size;
      v.date = date;
      changed = true;
    } else {
      console.log(`${app.name}: 无变化 (${size} bytes)`);
    }
  }
}

if (changed) {
  fs.writeFileSync(file, JSON.stringify(source, null, 2) + '\n', 'utf8');
  console.log('apps.json 已更新');
} else {
  console.log('apps.json 不变');
}
