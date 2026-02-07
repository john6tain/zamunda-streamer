"use client";
import {useAuthCheck} from "@/app/hooks/useAuthCheck";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import React, {useCallback, useEffect, useState} from "react";
import {apiDelete, apiGet, axiosInterceptor} from "@/lib/apiService";
import {useRouter, useSearchParams} from "next/navigation";
import {toast} from "sonner";
import ListOfMovies from "@/components/listOfMovies";
import {Label} from "@/components/ui/label";
import {Switch} from "@/components/ui/switch";
import {Spinner} from "@/components/ui/spinner";

const Dashboard = () => {
	const {authenticated} = useAuthCheck();
	const [search, setSearch] = useState("");
	const [tableData, setTableData] = useState<TableData[]>([]);
	const [pages, setPages] = useState(0);
	const [activePage, setActivePage] = useState(0);
	const [isOpen, setIsOpen] = useState(false);
	const [isVideoReady, setVideoReady] = useState(false);
	const [movieName, setMovieName] = useState(false);
	const [streamUrl, setStreamUrl] = useState('');
	const [torrentUrl, setTorrentUrl] = useState('');
	const [isAutoplayOn, setIsAutoplayOn] = useState(false);
	const [fileIndex, setFileIndex] = useState(0);
	const router = useRouter();
	const searchParams = useSearchParams();
	const [loading, setLoading] = useState(false);
	const [handledTorrentParam, setHandledTorrentParam] = useState(false);

	useEffect(() => {
		axiosInterceptor(setLoading);
	}, [setLoading]);

	const logout = async () => {
		try {
			await apiDelete("/logout");
			toast.success("Logout successful");
			router.push("/login");
		} catch (error) {
			toast.error(`Error logging out: ${error}`,);
		}
	};

	const kill = async () => {
		try {
			await apiDelete(`/stream/${fileIndex}`);
			toast.success("Stream killed successfully");
			setVideoReady(false)
		} catch (error) {
			toast.error(`Error killing it: ${error}`,);
		}
	};


	const callSearch = async (page?: number) => {
		try {
			if (page !== undefined) setActivePage(page);

			const response = await apiGet(`/searches/${encodeURIComponent(search)}${page !== undefined ? "?page=" + page : ""}`);
			setTableData(response.tableData);
			setPages(response.pages);
			setIsOpen(true);
		} catch (error) {
			toast.error(`Error fetching data: ${error}`);
		}
	};

	const getTorrent = useCallback(async (url: string) => {
		try {
			setTorrentUrl(url);
			const response = await apiGet(`/torrent?torrent=${encodeURIComponent(url)}`);
			if (!localStorage.getItem(url)) {
				localStorage.setItem(url, JSON.stringify(response.files));
				setTableData(response.files);
			} else {
				setTableData(JSON.parse(localStorage.getItem(url) as string));

			}
			setIsOpen(true);
		} catch (error) {
			toast.error(`Error fetching torrent: ${error}`);
		}
	}, []);

	useEffect(() => {
		const torrentParam = searchParams.get('torrent');
		if (torrentParam && !handledTorrentParam) {
			setHandledTorrentParam(true);
			getTorrent(torrentParam).finally(() => {
				router.replace('/dashboard');
			});
		}
	}, [handledTorrentParam, searchParams, router, getTorrent]);

	const startStreaming = async (fileIndex: number) => {
		markAsWatched(fileIndex);
		setFileIndex(fileIndex);
		try {
			const response = await apiGet(`/stream/${fileIndex}`);
			console.log(response)
			setMovieName(response.name);
			setStreamUrl(response.url);
			setVideoReady(true);
			setIsOpen(false);
		} catch (error) {
			toast.error(`Error starting stream:${error}`);

		}
	};
	const markAsWatched = (fileIndex: number) => {
		if (localStorage.getItem(torrentUrl)) {
			const files = JSON.parse(localStorage.getItem(torrentUrl) as string);
			files[fileIndex].watched = true;
			localStorage.setItem(torrentUrl, JSON.stringify(files));
		}
	};

	if (!authenticated) return null;

	const downloadM3U = () => {
		const m3uContent = `#EXTM3U\n#EXTINF:-1,${movieName}\n${streamUrl}`;
		const blob = new Blob([m3uContent], {type: "audio/x-mpegurl"});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "stream.m3u";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const startAutoPlay = async () => {
		if (isAutoplayOn) {
			console.log("playing next");
			await startStreaming(fileIndex + 1);
		}
	};

	const showList = () => {
		setTableData(JSON.parse(localStorage.getItem(torrentUrl) as string));
		setIsOpen(true);
	};

	return (
		<div>
			{loading && <Spinner className="absolute top-2 left-2 size-8 text-indigo-600" />}
			<Button
				type="button"
				onClick={logout}
				className="absolute top-2 right-2 py-2 px-4 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500"
			>
				Logout
			</Button>
			{!isVideoReady && <div className="w-full max-w-sm p-10 bg-white dark:bg-gray-700 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-center mb-6 text-white dark:text-gray-200">Search a movie</h2>
          <Input
              id="search"
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && callSearch()}
              placeholder="Enter your movie name"
              className="w-full mt-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:bg-gray-600 dark:text-white"
          />
          <Button
              type="button"
              onClick={() => callSearch()}
              className="w-full py-2 px-4 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500 mt-2"
          >
              Search
          </Button>
      </div>}

			{isVideoReady &&
          <div className="w-full max-w-sm p-[3rem] bg-white dark:bg-gray-700 rounded-lg shadow-lg relative">
              <div className="absolute top-2 right-2 py-2 px-4 w-full max-w-md">
                  <div className="flex items-center justify-between w-full">
                      <div className="invisible">
                          <Button className="opacity-0">Kill</Button>
                      </div>

                      <div className="flex items-center space-x-2 absolute left-1/2 transform -translate-x-1/2">
                          <Switch id="airplay-mode" checked={isAutoplayOn} onCheckedChange={() => {
														setIsAutoplayOn(!isAutoplayOn)
													}}/>
                          <Label htmlFor="airplay-mode">Autoplay</Label>
                      </div>

                      <Button
                          type="button"
                          onClick={kill}
                          className="bg-indigo-500 text-white rounded-md hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                      >
                          Kill
                      </Button>
                  </div>
              </div>

              <video className="mt-4" controls src={`${streamUrl}`} width="640" height="360"
                     onEnded={async () => {
											 await startAutoPlay();
										 }}></video>
              <div>Enter manually: {streamUrl} </div>
              <Button
                  type="button"
                  onClick={() => downloadM3U()}
                  className="w-full py-2 px-4 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500 mt-2"
              >
                  Open in VLC
              </Button>
              <Button
                  type="button"
                  onClick={() => showList()}
                  className="w-full py-2 px-4 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500 mt-2"
              >
                  Show list again
              </Button>
          </div>}

			<ListOfMovies
				isOpen={isOpen}
				tableData={tableData}
				setIsOpen={setIsOpen}
				pages={pages}
				activePage={activePage}
				callSearch={callSearch}
				getTorrent={getTorrent}
				startStreaming={startStreaming} // Pass the streaming function
			/>
		</div>
	);
};

export default Dashboard;
