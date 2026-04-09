import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import * as os from "os";
import Engine from "engine";
import net from "net";
import { spawn, ChildProcess } from "child_process";
import { getStreamBackendFromCookieHeader } from "@/lib/streamBackend";

const TMP_DIR = path.join(process.cwd(), "tmp");
const TEMP_TORRENT_PATH = path.join(TMP_DIR, "temp.torrent");
const CURRENT_SOURCE_PATH = path.join(TMP_DIR, "current-source.json");
const CURRENT_WEBTORRENT_META_PATH = path.join(TMP_DIR, "current-webtorrent-meta.json");
const LOCAL_WEBTORRENT_CLI_JS = path.join(process.cwd(), "node_modules", "webtorrent-cli", "bin", "cmd.js");
const LOCAL_WEBTORRENT_BIN = path.join(
	process.cwd(),
	"node_modules",
	".bin",
	process.platform === "win32" ? "webtorrent.cmd" : "webtorrent"
);

type TorrentSource =
	| { kind: "torrent-file"; path: string }
	| { kind: "magnet"; value: string };

type PeerflixSession = { backend: "peerflix"; engine: Engine; port: number };
type WebTorrentSession = { backend: "webtorrent"; process: ChildProcess; port: number };
type ActiveSession = PeerflixSession | WebTorrentSession;

const activeSessions = new Map<string, ActiveSession>();

function stripAnsi(input: string): string {
	return input.replace(/\x1b\[[0-9;]*m/g, "");
}

function getServerIp(): string {
	const interfaces = os.networkInterfaces();
	const preferredInterface = process.env.NETWORK_INTERFACE || "Ethernet";
	const preferredIp = process.env.SERVER_IP || process.env.HOST_IP;

	if (preferredIp) {
		return preferredIp;
	}

	const availableInterfaces: { [key: string]: string[] } = {};
	for (const name of Object.keys(interfaces)) {
		const ips = interfaces[name]!
			.filter((iface) => iface.family === "IPv4" && !iface.internal)
			.map((iface) => iface.address);
		if (ips.length > 0) {
			availableInterfaces[name] = ips;
		}
	}

	if (preferredInterface && availableInterfaces[preferredInterface]) {
		return availableInterfaces[preferredInterface][0];
	}

	for (const name of Object.keys(availableInterfaces)) {
		const ip = availableInterfaces[name][0];
		if (ip.startsWith("192.168.")) {
			return ip;
		}
	}

	for (const name of Object.keys(availableInterfaces)) {
		if (availableInterfaces[name].length > 0) {
			return availableInterfaces[name][0];
		}
	}

	return "127.0.0.1";
}

async function findAvailablePort(startPort: number = 8888): Promise<number> {
	let port = startPort;
	const usedPorts = Array.from(activeSessions.values()).map((entry) => entry.port);

	while (port <= 65535) {
		if (usedPorts.includes(port)) {
			port++;
			continue;
		}

		const server = net.createServer();
		try {
			await new Promise<number>((resolve, reject) => {
				server.once("listening", () => resolve(port));
				server.once("error", (err: NodeJS.ErrnoException) => {
					if (err.code === "EADDRINUSE") resolve(0);
					else reject(err);
				});
				server.listen(port);
			});
			server.close();
			return port;
		} catch {
			port++;
		}
	}
	throw new Error("No available ports found");
}

async function destroyPeerflixEngine(engine: Engine): Promise<void> {
	return new Promise((resolve) => {
		if (engine.server) {
			engine.server.close(() => undefined);
		}
		engine.destroy(() => resolve());
	});
}

async function destroyWebTorrentSession(session: WebTorrentSession): Promise<void> {
	await new Promise<void>((resolve) => {
		if (session.process.killed) {
			resolve();
			return;
		}
		session.process.once("exit", () => resolve());
		session.process.kill();
		setTimeout(() => {
			if (!session.process.killed) {
				session.process.kill("SIGKILL");
			}
			resolve();
		}, 1500);
	});
}

async function destroySession(session: ActiveSession): Promise<void> {
	if (session.backend === "peerflix") {
		await destroyPeerflixEngine(session.engine);
		return;
	}
	await destroyWebTorrentSession(session);
}

function loadCurrentSource(): Buffer | string {
	if (fs.existsSync(CURRENT_SOURCE_PATH)) {
		const raw = fs.readFileSync(CURRENT_SOURCE_PATH, "utf8");
		const source = JSON.parse(raw) as TorrentSource;
		if (source.kind === "magnet") {
			return source.value;
		}
		return fs.readFileSync(source.path);
	}

	if (fs.existsSync(TEMP_TORRENT_PATH)) {
		return fs.readFileSync(TEMP_TORRENT_PATH);
	}

	throw new Error("Torrent source not found");
}

function loadWebTorrentMeta(): { infoHash?: string; files: Array<{ index: number; path: string }> } | null {
	if (!fs.existsSync(CURRENT_WEBTORRENT_META_PATH)) {
		console.log("[webtorrent][meta] file missing", { path: CURRENT_WEBTORRENT_META_PATH });
		return null;
	}
	try {
		const raw = fs.readFileSync(CURRENT_WEBTORRENT_META_PATH, "utf8");
		const parsed = JSON.parse(raw) as { infoHash?: string; files?: Array<{ index: number; path: string }> };
		if (!Array.isArray(parsed.files)) {
			console.log("[webtorrent][meta] invalid files payload", { path: CURRENT_WEBTORRENT_META_PATH });
			return null;
		}
		console.log("[webtorrent][meta] loaded", {
			path: CURRENT_WEBTORRENT_META_PATH,
			infoHash: parsed.infoHash || null,
			filesCount: parsed.files.length,
			firstFile: parsed.files[0]?.path || null,
		});
		return {
			infoHash: parsed.infoHash,
			files: parsed.files,
		};
	} catch {
		console.log("[webtorrent][meta] parse error", { path: CURRENT_WEBTORRENT_META_PATH });
		return null;
	}
}

function buildWebTorrentStreamPath(infoHash: string, filePath: string): string {
	return `/webtorrent/${encodeURIComponent(infoHash)}/${encodeURI(filePath)}`;
}

async function initializePeerflixEngine(torrentData: Buffer | string, initialPort: number): Promise<{ engine: Engine; port: number }> {
	let port = initialPort;
	let attempts = 0;
	const maxAttempts = 5;
	const mod = await import("peerflix");
	type PeerflixFn = (
		torrent: string | Buffer,
		options?: {
			connections?: number;
			port?: number;
			path?: string;
			verify?: boolean;
			dht?: boolean;
			tracker?: boolean;
			tmp?: string;
			buffer?: number;
			remove?: boolean;
		}
	) => Engine;
	const peerflix = (mod as unknown as { default?: PeerflixFn }).default ?? (mod as unknown as PeerflixFn);

	while (attempts < maxAttempts) {
		const engine = peerflix(torrentData, {
			port,
			tracker: true,
			remove: true,
		}) as Engine;

		try {
			await Promise.race([
				new Promise((resolve) => engine.on("ready", () => resolve(true))),
				new Promise((_, reject) => engine.on("error", (err: Error) => reject(err))),
				new Promise((resolve) => engine.on("listening", () => resolve(true))),
			]);

			if (!engine.server || !engine.server.listening) {
				throw new Error("Server failed to start listening");
			}

			return { engine, port };
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
				port = await findAvailablePort(port + 1);
				attempts++;
				await destroyPeerflixEngine(engine);
			} else {
				await destroyPeerflixEngine(engine);
				throw err;
			}
		}
	}
	throw new Error(`Failed to bind Peerflix after ${maxAttempts} attempts`);
}

function spawnWebTorrentCli(args: string[]): ChildProcess {
	console.log("[webtorrent][stream] spawn cli", { args });
	if (fs.existsSync(LOCAL_WEBTORRENT_CLI_JS)) {
		return spawn(process.execPath, [LOCAL_WEBTORRENT_CLI_JS, ...args], {
			cwd: process.cwd(),
			env: process.env,
			stdio: ["ignore", "pipe", "pipe"],
		});
	}

	const bin = fs.existsSync(LOCAL_WEBTORRENT_BIN) ? LOCAL_WEBTORRENT_BIN : "webtorrent";
	return spawn(bin, args, {
		cwd: process.cwd(),
		env: process.env,
		stdio: ["ignore", "pipe", "pipe"],
		shell: process.platform === "win32",
	});
}

async function initializeWebTorrentSession(
	torrentSource: string,
	initialPort: number,
	fileIdx: number,
	preferredPath?: string
): Promise<{ session: WebTorrentSession; streamUrl: string; fileName: string }> {
	const args = [
		"download",
		torrentSource,
		"--select",
		String(fileIdx),
		"--port",
		String(initialPort),
		"--out",
		TMP_DIR,
		"--keep-seeding",
		"--no-quit",
	];

	const child = spawnWebTorrentCli(args);
	console.log("[webtorrent][stream] session init", {
		fileIdx,
		initialPort,
		hasPreferredPath: Boolean(preferredPath),
		preferredPath: preferredPath || null,
	});

	return await new Promise((resolve, reject) => {
		let settled = false;
		let errLog = "";
		const timeout = setTimeout(() => {
			if (settled) return;
			settled = true;
			child.kill();
			reject(new Error(`WebTorrent CLI startup timeout. ${errLog}`.trim()));
		}, 20000);

		child.stdout?.on("data", (buf: Buffer) => {
			const text = stripAnsi(buf.toString());
			if (/Error:/i.test(text)) {
				errLog += text;
			}
		});

		child.stderr?.on("data", (buf: Buffer) => {
			const text = stripAnsi(buf.toString());
			errLog += text;
		});

		child.on("exit", (code) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			reject(new Error(`WebTorrent CLI exited early with code ${code}. ${errLog}`.trim()));
		});

		setTimeout(() => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			if (!preferredPath) {
				console.log("[webtorrent][stream] missing preferredPath", { fileIdx, initialPort });
				child.kill();
				reject(new Error("Missing WebTorrent file path metadata for selected file."));
				return;
			}
			const streamUrl = `http://localhost:${initialPort}${preferredPath}`;
			console.log("[webtorrent][stream] stream url built", { streamUrl });
			resolve({
				session: { backend: "webtorrent", process: child, port: initialPort },
				streamUrl,
				fileName: `Selected file ${fileIdx + 1}`,
			});
		}, 15000);
	});
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ fileIndex: string }> }
) {
	const { fileIndex } = await params;
	const fileIdx = Number(fileIndex);
	const clientId = req.headers.get("x-forwarded-for") || "unknown";
	const backend = getStreamBackendFromCookieHeader(req.headers.get("cookie"));

	if (!fs.existsSync(TMP_DIR)) {
		fs.mkdirSync(TMP_DIR, { recursive: true });
	}

	try {
		const torrentData = loadCurrentSource();
		const torrentSource = typeof torrentData === "string" ? torrentData : TEMP_TORRENT_PATH;

		if (activeSessions.has(clientId)) {
			const existing = activeSessions.get(clientId)!;
			await destroySession(existing);
			activeSessions.delete(clientId);
		}

		const initialPort = await findAvailablePort(8888);
		const serverIp = getServerIp();

		if (backend === "webtorrent") {
			const meta = loadWebTorrentMeta();
			const preferredFilePath = meta?.files.find((f) => f.index === fileIdx)?.path;
			const preferredPath = meta?.infoHash && preferredFilePath
				? buildWebTorrentStreamPath(meta.infoHash, preferredFilePath)
				: undefined;
			console.log("[webtorrent][stream] file selection", {
				requestedIndex: fileIdx,
				metaInfoHash: meta?.infoHash || null,
				metaFilesCount: meta?.files.length || 0,
				preferredFilePath: preferredFilePath || null,
				preferredPath: preferredPath || null,
			});
			const { session, streamUrl, fileName } = await initializeWebTorrentSession(torrentSource, initialPort, fileIdx, preferredPath);
			activeSessions.set(clientId, session);
			return NextResponse.json({
				message: "Streaming started for WebTorrent",
				url: streamUrl.replace("localhost", serverIp),
				name: fileName,
				backend: "webtorrent",
			});
		}

		const { engine, port } = await initializePeerflixEngine(torrentData, initialPort);
		const peerflixSession: PeerflixSession = { backend: "peerflix", engine, port };
		activeSessions.set(clientId, peerflixSession);

		const file = engine.files[fileIdx];
		if (!file) {
			throw new Error(`File at index ${fileIdx} not found`);
		}

		const actualPort = engine.server?.address()?.port || port;
		const peerflixUrl = `http://${serverIp}:${actualPort}/${fileIdx}`;
		return NextResponse.json({
			message: "Streaming started for Peerflix",
			url: peerflixUrl,
			name: file.name,
			backend: "peerflix",
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Failed to start streaming";
		console.error(`Error for client ${clientId}:`, errorMessage);

		if (activeSessions.has(clientId)) {
			const session = activeSessions.get(clientId)!;
			await destroySession(session);
			activeSessions.delete(clientId);
		}

		return NextResponse.json(
			{ error: "Failed to start streaming", details: errorMessage, backend },
			{ status: 500 }
		);
	}
}

export async function DELETE(req: NextRequest) {
	const clientId = req.headers.get("x-forwarded-for") || "unknown";

	try {
		if (activeSessions.has(clientId)) {
			const session = activeSessions.get(clientId)!;
			await destroySession(session);
			activeSessions.delete(clientId);
			return NextResponse.json({ message: "Streaming stopped successfully" });
		}
		return NextResponse.json({ message: "No active stream found for this client" });
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Failed to stop streaming";
		return NextResponse.json(
			{ error: "Failed to stop streaming", details: errorMessage },
			{ status: 500 }
		);
	}
}

export const config = {
	api: {
		bodyParser: false,
	},
};
