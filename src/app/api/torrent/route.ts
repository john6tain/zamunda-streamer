import {NextRequest, NextResponse} from "next/server";
import {execFile, spawn} from "child_process";
import path from "path";
import {CookieJar} from "tough-cookie";
import {wrapper} from "axios-cookiejar-support";
import axios from "axios";
import * as fs from "fs";
import {getZamundaBaseUrlFromCookieHeader} from "@/lib/zamundaBaseUrl";
import {getStreamBackendFromCookieHeader} from "@/lib/streamBackend";

const cookieJar = new CookieJar();
const client = wrapper(axios.create({jar: cookieJar, withCredentials: true}));

const TMP_DIR = path.join(process.cwd(), 'tmp');
const TEMP_TORRENT_PATH = path.join(TMP_DIR, 'temp.torrent');
const CURRENT_SOURCE_PATH = path.join(TMP_DIR, 'current-source.json');
const CURRENT_WEBTORRENT_META_PATH = path.join(TMP_DIR, 'current-webtorrent-meta.json');
const LOCAL_PEERFLIX_BIN = path.join(
	process.cwd(),
	'node_modules',
	'.bin',
	process.platform === 'win32' ? 'peerflix.cmd' : 'peerflix'
);
const LOCAL_PEERFLIX_APP = path.join(process.cwd(), 'node_modules', 'peerflix', 'app.js');
const LOCAL_WEBTORRENT_CLI_JS = path.join(process.cwd(), 'node_modules', 'webtorrent-cli', 'bin', 'cmd.js');
const LOCAL_WEBTORRENT_BIN = path.join(
	process.cwd(),
	'node_modules',
	'.bin',
	process.platform === 'win32' ? 'webtorrent.cmd' : 'webtorrent'
);

type CurrentSource =
	| { kind: 'torrent-file'; path: string }
	| { kind: 'magnet'; value: string };

function ensureTmpDir() {
	if (!fs.existsSync(TMP_DIR)) {
		fs.mkdirSync(TMP_DIR, {recursive: true});
	}
}

function saveCurrentSource(source: CurrentSource) {
	ensureTmpDir();
	fs.writeFileSync(CURRENT_SOURCE_PATH, JSON.stringify(source), 'utf8');
}

function saveWebTorrentMeta(meta: { infoHash?: string; files: Array<{ index: number; path: string }> }) {
	ensureTmpDir();
	fs.writeFileSync(CURRENT_WEBTORRENT_META_PATH, JSON.stringify(meta), 'utf8');
	console.log('[webtorrent][meta] saved', {
		path: CURRENT_WEBTORRENT_META_PATH,
		infoHash: meta.infoHash || null,
		filesCount: meta.files.length,
		firstFile: meta.files[0]?.path || null,
	});
}

function stripAnsi(input: string): string {
	return input.replace(/\x1b\[[0-9;]*m/g, '');
}

function runPeerflixList(source: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const run = (
			bin: string,
			args: string[],
			fallback?: () => void
		) => {
			execFile(bin, args, { maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
				if (error) {
					const isNotFound = (error as NodeJS.ErrnoException).code === 'ENOENT';
					if (isNotFound && fallback) {
						fallback();
						return;
					}
					const details = stderr?.trim() ? ` (${stderr.trim()})` : '';
					reject(new Error(`Error executing command: ${error.message}${details}`));
					return;
				}
				resolve(stripAnsi(stdout));
			});
		};

		if (fs.existsSync(LOCAL_PEERFLIX_APP)) {
			run(process.execPath, [LOCAL_PEERFLIX_APP, source, '--list'], () => run(LOCAL_PEERFLIX_BIN, [source, '--list'], () => run('peerflix', [source, '--list'])));
			return;
		}
		run(LOCAL_PEERFLIX_BIN, [source, '--list'], () => run('peerflix', [source, '--list']));
	});
}

function runWebTorrentCli(args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const run = (bin: string, binArgs: string[], fallback?: () => void) => {
			const child = spawn(bin, binArgs, {
				cwd: process.cwd(),
				env: process.env,
				stdio: ['ignore', 'pipe', 'pipe'],
				shell: false,
			});

			let stdout = '';
			let stderr = '';
			let finished = false;
			const timeout = setTimeout(() => {
				if (finished) return;
				child.kill();
			}, 180000);

			child.stdout?.on('data', (chunk: Buffer) => {
				stdout += chunk.toString();
			});

			child.stderr?.on('data', (chunk: Buffer) => {
				stderr += chunk.toString();
			});

			child.on('error', (error) => {
				if (finished) return;
				finished = true;
				clearTimeout(timeout);
				const isNotFound = (error as NodeJS.ErrnoException).code === 'ENOENT';
				if (isNotFound && fallback) {
					fallback();
					return;
				}
				reject(new Error(`Error executing webtorrent command: ${error.message}`));
			});

			child.on('close', (code, signal) => {
				if (finished) return;
				finished = true;
				clearTimeout(timeout);
				const combined = stripAnsi(`${stdout}\n${stderr}`).trim();
				if (combined.length > 0) {
					resolve(combined);
					return;
				}
				reject(
					new Error(
						`Error executing webtorrent command: exit=${String(code)} signal=${String(signal)}`
					)
				);
			});
		};

		if (fs.existsSync(LOCAL_WEBTORRENT_CLI_JS)) {
			run(process.execPath, [LOCAL_WEBTORRENT_CLI_JS, ...args], () => run(LOCAL_WEBTORRENT_BIN, args, () => run('webtorrent', args)));
			return;
		}
		run(LOCAL_WEBTORRENT_BIN, args, () => run('webtorrent', args));
	});
}

function parsePeerflixFileList(output: string) {
	return output
		.trim()
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const idx = line.indexOf(':');
			if (idx < 0) {
				return {name: line, watched: false};
			}
			const indexPart = line.slice(0, idx).trim();
			const rest = line.slice(idx + 1);
			const asNumber = Number(indexPart);
			if (Number.isNaN(asNumber)) {
				return {name: line, watched: false};
			}
			return {
				name: `${asNumber + 1}:${rest}`,
				watched: false,
			};
		});
}

function parseWebTorrentList(output: string) {
	const files: Array<{ name: string; watched: boolean; index: number; path: string }> = [];
	const lines = output.split(/\r?\n/);
	for (const rawLine of lines) {
		const line = rawLine.trim();
		const match = line.match(/^(\d+)\s+(.+?)\s*\(([^)]+)\)$/);
		if (!match) {
			continue;
		}
		const index = Number(match[1]);
		const fileName = match[2].trim();
		const size = match[3].trim();
		files.push({
			name: `${index + 1}:${fileName} (${size})`,
			watched: false,
			index,
			path: fileName,
		});
	}
	return files;
}

function extractInfoHashFromSource(source: string): string | undefined {
	const match = source.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
	if (!match || !match[1]) {
		return undefined;
	}
	return match[1].toLowerCase();
}

async function extractInfoHashFromTorrentFile(filePath: string): Promise<string | undefined> {
	try {
		const parseTorrentMod = await import('parse-torrent');
		type ParseTorrentFn = (torrent: Buffer | string) => { infoHash?: string };
		const parseTorrent = (parseTorrentMod as unknown as { default?: ParseTorrentFn }).default
			?? (parseTorrentMod as unknown as ParseTorrentFn);
		const parsed = parseTorrent(fs.readFileSync(filePath));
		return parsed.infoHash?.toLowerCase();
	} catch {
		return undefined;
	}
}

async function listWithWebTorrentCli(source: string): Promise<Array<{ name: string; watched: boolean; index: number; path: string }>> {
	console.log('[webtorrent][list] cli start', { sourcePreview: source.slice(0, 120) });
	const output = await runWebTorrentCli(['download', source, '--select']);
	const parsed = parseWebTorrentList(output);
	console.log('[webtorrent][list] cli parsed', { filesCount: parsed.length });
	if (parsed.length === 0) {
		console.log('[webtorrent][list] raw-output', output.slice(0, 2000));
		throw new Error('WebTorrent CLI returned no parsable file list');
	}
	return parsed;
}

async function resolveSource(req: NextRequest, torrent: string, baseUrl: string) {
	const isMagnet = torrent.startsWith('magnet:?');

	if (isMagnet) {
		saveCurrentSource({kind: 'magnet', value: torrent});
		return torrent;
	}

	const cookies = req.headers.get('cookie');
	if (cookies) {
		cookies.split(';').forEach(cookie => {
			cookieJar.setCookie(cookie, baseUrl);
		});
	}

	const response = await client.get(torrent, {
		withCredentials: true,
		responseType: 'arraybuffer',
	});

	ensureTmpDir();
	fs.writeFileSync(TEMP_TORRENT_PATH, response.data);
	saveCurrentSource({kind: 'torrent-file', path: TEMP_TORRENT_PATH});
	return TEMP_TORRENT_PATH;
}

export async function GET(req: NextRequest) {
	const {searchParams} = new URL(req.url);
	const torrent = searchParams.get('torrent');
	const baseUrl = getZamundaBaseUrlFromCookieHeader(req.headers.get('cookie'));
	const streamBackend = getStreamBackendFromCookieHeader(req.headers.get('cookie'));

	if (!torrent) {
		return NextResponse.json({error: 'No torrent link provided'}, {status: 400});
	}
	console.log('Torrent source URL:', torrent);
	console.log('Selected backend:', streamBackend);

	try {
		const resolvedSource = await resolveSource(req, torrent, baseUrl);
		const source = typeof resolvedSource === 'string' ? resolvedSource : TEMP_TORRENT_PATH;

		if (streamBackend === 'webtorrent') {
			const infoHash = source.startsWith('magnet:?')
				? extractInfoHashFromSource(source)
				: await extractInfoHashFromTorrentFile(source);
			console.log('[webtorrent][list] infoHash resolved', { infoHash: infoHash || null, sourceIsMagnet: source.startsWith('magnet:?') });
			const parsed = await listWithWebTorrentCli(source);
			saveWebTorrentMeta({
				infoHash,
				files: parsed.map((f) => ({ index: f.index, path: f.path })),
			});
			const files = parsed.map((f) => ({ name: f.name, watched: f.watched }));
			return NextResponse.json({files, backend: 'webtorrent'});
		}

		const listOutput = await runPeerflixList(source);
		const files = parsePeerflixFileList(listOutput);
		return NextResponse.json({files, backend: 'peerflix'});
	} catch (error) {
		const details = error instanceof Error ? error.message : String(error);
		console.error('Error preparing torrent:', details);
		return NextResponse.json({error: 'Failed to list files', details}, {status: 500});
	}
}
