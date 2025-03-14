declare module 'peerflix' {

	import Engine from "engine";

	interface PeerflixOptions {
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


	// Allow the first argument to be a string (magnet link or file path) or a Buffer (.torrent file data)
	function peerflix(torrent: string | Buffer, options?: PeerflixOptions): Engine;

	export = peerflix;
}