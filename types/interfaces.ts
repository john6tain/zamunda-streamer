interface TableData {
	name?: string;
	image?: string;
	size?: string;
	link: string;
	icon1?: string;
	icon2?: string;
	downloaded?: string;
	seed?: string;
}

interface ListOfMoviesProps {
	isOpen: boolean;
	tableData: TableData[];
	setIsOpen: (isOpen: boolean) => void;
	pages: number;
	activePage: number;
	callSearch: (page: number) => void;
	getTorrent: (torrent: string) => void;
	startStreaming: (fileIdx: number) => void;
}