import React from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

export const VideoJS = (props) => {
	const videoRef = React.useRef(null);
	const playerRef = React.useRef(null);
	const { options, onReady } = props;

	React.useEffect(() => {
		if (!playerRef.current) {
			const videoElement = document.createElement('video-js');
			videoElement.classList.add(
				'vjs-matrix', // Default skin
				'vjs-fluid',         // Fluid layout (responsive)
				'vjs-big-play-centered', // Big play button centered
				'vjs-hls'            // For HLS streaming
			);
			videoRef.current.appendChild(videoElement);

			const player = (playerRef.current = videojs(videoElement, options, () => {
				videojs.log('player is ready');
				if (onReady) {
					onReady(player);
				}
			}));
		} else {
			const player = playerRef.current;
			player.autoplay(options.autoplay);
			player.src(options.sources);
		}
	}, [options]);

	React.useEffect(() => {
		const player = playerRef.current;
		// Clean up function to dispose the player after the component unmounts
		return () => {
			if (player && !player.isDisposed()) {
				player.dispose();
				playerRef.current = null;
			}
		};
	}, []);

	return (
		<div className='video-player w-64' data-vjs-player>
			<div ref={videoRef} />
		</div>
	);
};

export default VideoJS;