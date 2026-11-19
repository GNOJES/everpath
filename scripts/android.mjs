import { existsSync, mkdirSync, readFileSync, copyFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function javaMajor(text) { return Number(/(?:openjdk|java) version "(?:1\.)?(\d+)/.exec(text)?.[1] ?? 0); }
export function selectDevice(output, requested) {
 const devices = output.split(/\r?\n/).map(line => line.trim().split(/\s+/)).filter(parts => parts[1] === 'device').map(parts => parts[0]);
 if (requested) { if (!devices.includes(requested)) throw new Error(`Device ${requested} is absent, offline or unauthorized. Check adb devices -l and the phone's USB debugging prompt.`); return requested; }
 if (devices.length !== 1) throw new Error('Connect one authorized device, or pass its serial: npm run android:install -- SERIAL. Check adb devices -l.');
 return devices[0];
}
function run(command, args, env, cwd = root) {
 const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
 if (result.error) throw result.error;
 if (result.status !== 0) throw new Error(`${command} failed (exit ${result.status ?? 'signal'}).`);
}
function javaVersion(home) {
 if (!home) return 0;
 const result = spawnSync(join(home, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'), ['-version'], { encoding: 'utf8' });
 return javaMajor(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
}
function findJava() {
 if (process.env.JAVA_HOME) {
  if (javaVersion(process.env.JAVA_HOME) !== 21) throw new Error('JAVA_HOME must point to JDK 21 for this Gradle/Capacitor project. See README Android prerequisites.');
  return process.env.JAVA_HOME;
 }
 const candidates = [
  '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
  '/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
  '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Programs', 'Android Studio', 'jbr'),
  process.env.ProgramFiles && join(process.env.ProgramFiles, 'Android', 'Android Studio', 'jbr'),
  '/opt/android-studio/jbr',
 ];
 if (process.platform === 'darwin') {
  const result = spawnSync('/usr/libexec/java_home', ['-v', '21'], { encoding: 'utf8' });
  if (result.status === 0) candidates.unshift(result.stdout.trim());
 }
 const fromPath = spawnSync('java', ['-XshowSettings:properties', '-version'], { encoding: 'utf8' });
 const pathHome = /java\.home\s*=\s*(.+)/.exec(fromPath.stderr ?? '')?.[1]?.trim();
 if (pathHome) candidates.push(pathHome);
 const home = candidates.filter(Boolean).find(candidate => javaVersion(candidate) === 21);
 if (!home) throw new Error('JDK 21 was not found. Set JAVA_HOME to a JDK 21 installation; see README.');
 return home;
}
function findSdk(build = true) {
 const home = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (process.platform === 'darwin' ? join(homedir(), 'Library', 'Android', 'sdk') : process.platform === 'win32' ? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk') : join(homedir(), 'Android', 'Sdk'));
 if (build && (!existsSync(join(home, 'platforms', 'android-36', 'android.jar')) || !existsSync(join(home, 'build-tools', '36.0.0')))) throw new Error(`Android SDK 36 / Build Tools 36.0.0 not found at ${home}. Install them in Android Studio SDK Manager, or set ANDROID_HOME.`);
 return home;
}
async function main() {
 const mode = process.argv[2] ?? 'doctor';
 if (!['doctor', 'sync', 'build', 'install'].includes(mode)) throw new Error('Usage: node scripts/android.mjs doctor|sync|build|install [SERIAL]');
 const sdk = findSdk(mode !== 'install');
 const env = { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk };
 const output = join(root, 'artifacts', 'android'), apk = join(output, 'everpath-debug.apk');
 if (mode === 'install') {
  if (!existsSync(apk)) throw new Error('APK missing. Run npm run android:apk first.');
  const adb = join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  const listed = spawnSync(adb, ['devices', '-l'], { env, encoding: 'utf8' });
  if (listed.error || listed.status !== 0) throw new Error('Could not run SDK platform-tools/adb. Install Android SDK Platform-Tools.');
  const serial = selectDevice(listed.stdout, process.argv[3]);
  run(adb, ['-s', serial, 'install', '-r', apk], env); return;
 }
 env.JAVA_HOME = findJava();
 console.log(`JDK 21: ${env.JAVA_HOME}\nAndroid SDK: ${sdk}`);
 if (mode === 'doctor') return;
 const npmCli = process.env.npm_execpath;
 if (npmCli) run(process.execPath, [npmCli, 'run', 'build'], env);
 else {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error || result.status !== 0) throw new Error('Web build failed. Run through npm run android:apk.');
 }
 run(process.execPath, [join(root, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor'), 'sync', 'android'], env);
 if (mode === 'sync') return;
 const android = join(root, 'android');
 if (process.platform === 'win32') run('cmd.exe', ['/d', '/c', 'gradlew.bat', '--no-daemon', 'assembleDebug'], env, android);
 else run(join(android, 'gradlew'), ['--no-daemon', 'assembleDebug'], env, android);
 const built = join(android, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
 const signer = join(sdk, 'build-tools', '36.0.0', process.platform === 'win32' ? 'apksigner.bat' : 'apksigner');
 if (process.platform === 'win32') run('cmd.exe', ['/d', '/c', signer, 'verify', '--verbose', built], env);
 else run(signer, ['verify', '--verbose', built], env);
 mkdirSync(output, { recursive: true }); copyFileSync(built, apk);
 const bytes = readFileSync(apk), sha256 = createHash('sha256').update(bytes).digest('hex');
 writeFileSync(`${apk}.sha256`, `${sha256}  everpath-debug.apk\n`);
 const gradle = readFileSync(join(android, 'app', 'build.gradle'), 'utf8');
 const info = { appId: /applicationId\s+"([^"]+)"/.exec(gradle)?.[1], version: /versionName\s+"([^"]+)"/.exec(gradle)?.[1], variant: 'debug', capacitor: JSON.parse(readFileSync(join(root, 'node_modules', '@capacitor', 'core', 'package.json'), 'utf8')).version, minSdk: 24, targetSdk: 36, java: 21, bytes: bytes.length, sha256, builtAt: new Date().toISOString() };
 writeFileSync(join(output, 'build-info.json'), `${JSON.stringify(info, null, 2)}\n`);
 console.log(`\nVerified APK: ${apk}\nSHA-256: ${sha256}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
