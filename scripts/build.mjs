import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { build } from 'vite';

function seoulDate() {
 const parts = new Intl.DateTimeFormat('en', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
 }).formatToParts();
 return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('');
}

async function nextLocalBuild(date) {
 const directory = new URL(`../artifacts/build-versions/${date}/`, import.meta.url);
 await mkdir(directory, { recursive: true });
 const versions = (await readdir(directory)).filter(name => /^\d+$/.test(name)).map(Number);
 let number = Math.max(0, ...versions);
 while (true) {
  number++;
  try {
   await writeFile(new URL(String(number), directory), '', { flag: 'wx' });
   return number;
  } catch (error) {
   if (error.code !== 'EEXIST') throw error;
  }
 }
}

async function nextProductionBuild(date) {
 const url = new URL('https://everpath-roan.vercel.app/version.json');
 const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
 if (response.status === 404) return 1;
 if (!response.ok) throw new Error(`Cannot read the published version (HTTP ${response.status}).`);
 const { version } = await response.json();
 const previous = /^(\d{8})-(\d{2,})$/.exec(version);
 if (!previous) throw new Error('The published build version has an invalid format.');
 return previous[1] === date ? Number(previous[2]) + 1 : 1;
}

const date = seoulDate();
const number = process.env.VERCEL_ENV === 'production' ? await nextProductionBuild(date) : await nextLocalBuild(date);
const version = `${date}-${String(number).padStart(2, '0')}`;
console.log(`Building Everpath ver. ${version}`);
await build({
 define: { 'import.meta.env.VITE_BUILD_VERSION': JSON.stringify(version) },
 plugins: [{
  name: 'everpath-build-version',
  generateBundle() {
   this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) });
  },
 }],
});
