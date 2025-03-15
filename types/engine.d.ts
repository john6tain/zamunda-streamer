declare module 'engine' {
	interface File {
		name: string;
		path: string;
		length: number;
		// Add other properties as needed
	}
	interface Engine {
		server: any;
		torrent: any;
		files: File[];
		destroy: (listener: (...args: any[]) => void) => void;
		on(event: string, listener: (...args: any[]) => void): void;
		once(event: string, listener: (...args: any[]) => void): void;
		removeListener(event: string, listener: (...args: any[]) => void): void;
	}
	export = Engine;
}