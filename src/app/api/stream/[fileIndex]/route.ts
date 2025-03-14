import {NextRequest, NextResponse} from "next/server";
import peerflix from "peerflix";
import path from "path";
import fs from "fs";
import Engine from "engine";


let engine: Engine;

export async function GET(req: NextRequest, {params}: { params: Promise<{ fileIndex: string }> }) {
	const {fileIndex} = await params;
	const fileIdx = Number(fileIndex);

	const tmpDir = path.join(process.cwd(), "tmp");
	const torrentFilePath = path.join(tmpDir, "temp.torrent");

	if (!fs.existsSync(torrentFilePath)) {
		console.error("Torrent file not found at:", torrentFilePath);
		return NextResponse.json({error: "Torrent file not found"}, {status: 400});
	}

	const torrentData = fs.readFileSync(torrentFilePath);
	console.log("Loaded torrent data, size:", torrentData.length, "bytes");

	try {
		console.log("Initializing Peerflix...");
		engine = peerflix(torrentData, {
			port: 8888,
			tracker: true,
			remove: true,
		});

		await new Promise<void>((resolve, reject) => {
			engine.on("ready", () => {
				console.log("Peerflix ready, files:", engine.files.map((f) => f.name));
				resolve();
			});
			engine.on("error", (err: Error) => {
				console.error("Peerflix error:", err);
				reject(err);
			});
		});

		const file = engine.files[fileIdx];
		if (!file) {
			throw new Error(`File at index ${fileIdx} not found`);
		}
		console.log("Selected file:", file.name, "size:", file.length, "bytes");

		const peerflixUrl = `http://localhost:8888/${fileIdx}`;
		console.log("Peerflix streaming URL:", peerflixUrl);

		return NextResponse.json({
			message: "Streaming started for VLC",
			url: peerflixUrl,
			name: file.name
		});

	} catch (error) {
		let errorMessage = "Failed to start streaming";
		if (error instanceof Error) {
			errorMessage = error.message;
		}

		return NextResponse.json({
			error: "Failed to start streaming",
			details: errorMessage,
		}, {status: 500});
	}
}

export async function DELETE() {
	try {
		console.log("Stopping stream...");
		if (engine) {
			engine.destroy();
		}
		return NextResponse.json({message: "Streaming stopped successfully"});
	} catch (error) {
		let errorMessage = "Failed to stop streaming";
		if (error instanceof Error) {
			errorMessage = error.message;
		}

		return NextResponse.json({
			error: "Failed to stop streaming",
			details: errorMessage,
		}, {status: 500});
	}
}

export const config = {
	api: {
		bodyParser: false,
	},
};