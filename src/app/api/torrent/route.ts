import {NextRequest, NextResponse} from "next/server";
import {execFile} from "child_process";
import path from "path";
import {CookieJar} from "tough-cookie";
import {wrapper} from "axios-cookiejar-support";
import axios from "axios";
import * as fs from "fs";
import {getZamundaBaseUrlFromCookieHeader} from "@/lib/zamundaBaseUrl";

const cookieJar = new CookieJar();
const client = wrapper(axios.create({jar: cookieJar, withCredentials: true}));

const TMP_DIR = path.join(process.cwd(), 'tmp');
const TEMP_TORRENT_PATH = path.join(TMP_DIR, 'temp.torrent');
const CURRENT_SOURCE_PATH = path.join(TMP_DIR, 'current-source.json');
const LOCAL_PEERFLIX_BIN = path.join(
	process.cwd(),
	'node_modules',
	'.bin',
	process.platform === 'win32' ? 'peerflix.cmd' : 'peerflix'
);
const LOCAL_PEERFLIX_APP = path.join(process.cwd(), 'node_modules', 'peerflix', 'app.js');

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

function runPeerflixList(source: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const run = (
			bin: string,
			args: string[],
			fallback?: () => void
		) => {
			execFile(bin, args, (error, stdout, stderr) => {
				if (error) {
					const isNotFound = (error as NodeJS.ErrnoException).code === 'ENOENT';
					if (isNotFound && fallback) {
						fallback();
						return;
					}
					const details = stderr?.trim() ? ` (${stderr.trim()})` : '';
					reject(`Error executing command: ${error.message}${details}`);
					return;
				}
				if (stderr) {
					console.error(`Peerflix Error: ${stderr}`);
				}
				const cleanedOutput = stdout.replace(/\x1b\[[0-9;]*m/g, '');
				resolve(cleanedOutput);
			});
		};

		if (fs.existsSync(LOCAL_PEERFLIX_APP)) {
			run(process.execPath, [LOCAL_PEERFLIX_APP, source, '--list'], () => run(LOCAL_PEERFLIX_BIN, [source, '--list'], () => run('peerflix', [source, '--list'])));
			return;
		}
		run(LOCAL_PEERFLIX_BIN, [source, '--list'], () => run('peerflix', [source, '--list']));
	});
}

function parseFileList(output: string) {
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

export async function GET(req: NextRequest) {
	const {searchParams} = new URL(req.url);
	const torrent = searchParams.get("torrent");
	const baseUrl = getZamundaBaseUrlFromCookieHeader(req.headers.get('cookie'));

	if (!torrent) {
		return NextResponse.json({error: "No torrent link provided"}, {status: 400});
	}
	console.log("Torrent source URL:", torrent);

	const isMagnet = torrent.startsWith('magnet:?');

	try {
		let listOutput: string;
		if (isMagnet) {
			saveCurrentSource({kind: 'magnet', value: torrent});
			listOutput = await runPeerflixList(torrent);
		} else {
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
			listOutput = await runPeerflixList(TEMP_TORRENT_PATH);
		}

		const files = parseFileList(listOutput);
		return NextResponse.json({files});
	} catch (error) {
		console.error("Error starting Peerflix:", error);
		return NextResponse.json({error: "Failed to start Peerflix"}, {status: 500});
	}
}
