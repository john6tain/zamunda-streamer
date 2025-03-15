import { NextRequest, NextResponse } from "next/server";
import peerflix from "peerflix";
import path from "path";
import fs from "fs";
import * as os from "os";
import Engine from "engine";
import net from "net";

const activeEngines = new Map<string, { engine: Engine; port: number }>();

function getServerIp(): string {
	const interfaces = os.networkInterfaces();
	const preferredInterface = process.env.NETWORK_INTERFACE || "Ethernet";
	const preferredIp = process.env.SERVER_IP || process.env.HOST_IP;

	if (preferredIp) {
		console.log(`Using preferred server IP from env: ${preferredIp}`);
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

	console.log("Available network interfaces:", availableInterfaces);

	if (preferredInterface && availableInterfaces[preferredInterface]) {
		console.log(`Using IP from preferred interface ${preferredInterface}: ${availableInterfaces[preferredInterface][0]}`);
		return availableInterfaces[preferredInterface][0];
	}

	for (const name of Object.keys(availableInterfaces)) {
		const ip = availableInterfaces[name][0];
		if (ip.startsWith("192.168.")) {
			console.log(`Using LAN IP: ${ip} from ${name}`);
			return ip;
		}
	}

	for (const name of Object.keys(availableInterfaces)) {
		if (availableInterfaces[name].length > 0) {
			console.log(`Using first available IP: ${availableInterfaces[name][0]} from ${name}`);
			return availableInterfaces[name][0];
		}
	}

	console.log("No external IPs found, falling back to 127.0.0.1");
	return "127.0.0.1";
}

async function findAvailablePort(startPort: number = 8888): Promise<number> {
	let port = startPort;

	const usedPorts = Array.from(activeEngines.values()).map((entry) => entry.port);

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
		} catch (err) {
			console.error(`Error testing port ${port}:`, err);
			port++;
		}
	}
	throw new Error("No available ports found");
}

async function destroyEngine(engine: Engine): Promise<void> {
	return new Promise((resolve) => {
		if (engine.server) {
			engine.server.close(() => {
				console.log("Peerflix server closed");
			});
		}
		engine.destroy(() => {
			console.log("Peerflix engine destroyed");
			resolve();
		});
	});
}

async function initializeEngine(torrentData: Buffer, initialPort: number): Promise<{ engine: Engine; port: number }> {
	let port = initialPort;
	let attempts = 0;
	const maxAttempts = 5;

	while (attempts < maxAttempts) {
		console.log(`Attempt ${attempts + 1}/${maxAttempts}: Initializing Peerflix on port ${port}...`);
		const engine = peerflix(torrentData, {
			port,
			tracker: true,
			remove: true,
		}) as Engine;

		try {
			await Promise.race([
				new Promise((resolve) => {
					engine.on("ready", () => {
						console.log("Peerflix ready, files:", engine.files.map((f) => f.name));
						resolve(true);
					});
				}),
				new Promise((_, reject) => {
					engine.on("error", (err: Error) => {
						console.error(`Peerflix error on port ${port}:`, err);
						reject(err);
					});
				}),
				new Promise((resolve) => {
					engine.on("listening", () => {
						const address = engine.server?.address();
						console.log("Peerflix server listening on port:", address?.port);
						resolve(true);
					});
				}),
			]);

			if (!engine.server || !engine.server.listening) {
				throw new Error("Server failed to start listening");
			}

			return { engine, port };
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
				console.log(`Port ${port} in use, finding a new one...`);
				port = await findAvailablePort(port + 1);
				attempts++;
				await destroyEngine(engine);
			} else {
				await destroyEngine(engine);
				throw err;
			}
		}
	}
	throw new Error(`Failed to bind Peerflix after ${maxAttempts} attempts`);
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ fileIndex: string }> }
) {
	const { fileIndex } = await params;
	const fileIdx = Number(fileIndex);

	const clientId = req.headers.get("x-forwarded-for") || "unknown";
	console.log(`Request from client: ${clientId}`);

	const tmpDir = path.join(process.cwd(), "tmp");
	const torrentFilePath = path.join(tmpDir, "temp.torrent");

	if (!fs.existsSync(torrentFilePath)) {
		console.error("Torrent file not found at:", torrentFilePath);
		return NextResponse.json({ error: "Torrent file not found" }, { status: 400 });
	}

	const torrentData = fs.readFileSync(torrentFilePath);
	console.log("Loaded torrent data, size:", torrentData.length, "bytes");

	try {
		if (activeEngines.has(clientId)) {
			console.log(`Killing existing session for client ${clientId}...`);
			const clientEngine = activeEngines.get(clientId);
			if (clientEngine) {
				const { engine } = clientEngine;
				await destroyEngine(engine);
				activeEngines.delete(clientId);
			}
		}

		const initialPort = await findAvailablePort(8888);
		console.log(`Assigned initial port ${initialPort} for client ${clientId}`);

		const { engine, port } = await initializeEngine(torrentData, initialPort);
		activeEngines.set(clientId, { engine, port });

		const file = engine.files[fileIdx];
		if (!file) {
			throw new Error(`File at index ${fileIdx} not found`);
		}
		console.log("Selected file:", file.name, "size:", file.length, "bytes");

		const serverIp = getServerIp();
		const actualPort = engine.server?.address()?.port || port;
		const peerflixUrl = `http://${serverIp}:${actualPort}/${fileIdx}`;
		console.log("Peerflix streaming URL:", peerflixUrl);

		return NextResponse.json({
			message: "Streaming started for VLC",
			url: peerflixUrl,
			name: file.name,
		});
	} catch (error) {
		let errorMessage = "Failed to start streaming";
		if (error instanceof Error) {
			errorMessage = error.message;
		}
		console.error(`Error for client ${clientId}:`, errorMessage);

		if (activeEngines.has(clientId)) {
			const clientEngine = activeEngines.get(clientId);
			if (clientEngine) {
				const { engine } = clientEngine;
				await destroyEngine(engine);
				activeEngines.delete(clientId);
			}
		}

		return NextResponse.json(
			{ error: "Failed to start streaming", details: errorMessage },
			{ status: 500 }
		);
	}
}

export async function DELETE(req: NextRequest) {
	const clientId = req.headers.get("x-forwarded-for") || "unknown";
	console.log(`DELETE request from client: ${clientId}`);

	try {
		if (activeEngines.has(clientId)) {
			console.log(`Stopping stream for client ${clientId}...`);
			const clientEngine = activeEngines.get(clientId);
			if (clientEngine) {
				const { engine } = clientEngine;
				await destroyEngine(engine);
				activeEngines.delete(clientId);
			}
			return NextResponse.json({ message: "Streaming stopped successfully" });
		} else {
			return NextResponse.json({ message: "No active stream found for this client" });
		}
	} catch (error) {
		let errorMessage = "Failed to stop streaming";
		if (error instanceof Error) {
			errorMessage = error.message;
		}
		console.error(`Error stopping stream for client ${clientId}:`, errorMessage);
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