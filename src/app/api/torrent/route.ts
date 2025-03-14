import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import {fileURLToPath} from "url";
import {CookieJar} from "tough-cookie";
import {wrapper} from "axios-cookiejar-support";
import axios from "axios";
import * as fs from "fs";

const cookieJar = new CookieJar();
const client = wrapper(axios.create({jar: cookieJar, withCredentials: true}));

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const torrent = searchParams.get("torrent");

	if (!torrent) {
		return NextResponse.json({ error: "No torrent link provided" }, { status: 400 });
	}
	const cookies = req.headers.get('cookie');
	if (cookies) {
		cookies.split(';').forEach(cookie => {
			cookieJar.setCookie(cookie, 'https://www.zamunda.net');
		});
	}
	const response = await client.get(torrent, {
		withCredentials: true,
		responseType: 'arraybuffer',
	});
	const tmpDir = path.join(process.cwd(), 'tmp'); // The 'tmp' folder in the project root
	const torrentFilePath = path.join(tmpDir, 'temp.torrent');
	fs.writeFileSync(torrentFilePath, response.data);


	try {
		const execPromise = new Promise((resolve, reject) => {
			exec(`peerflix ${torrentFilePath} --list`, (error, stdout, stderr) => {
				if (error) {
					reject(`Error executing command: ${error.message}`);
				}
				if (stderr) {
					console.error(`Peerflix Error: ${stderr}`);
				}
				const cleanedOutput = stdout.replace(/\x1b\[[0-9;]*m/g, "");

				resolve(cleanedOutput);
			});
		});

		const fileList = await execPromise;
		return NextResponse.json({ files: fileList.trim().split("\n") });
	} catch (error) {
		console.error("Error starting Peerflix:", error);
		return NextResponse.json({ error: "Failed to start Peerflix" }, { status: 500 });
	}
}
