import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{ key: "Access-Control-Allow-Credentials", value: "true" },
					{ key: "Access-Control-Allow-Origin", value: "https://your-kasm-domain.com" }, // Update with your actual Kasm domain
					{ key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
					{ key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
				],
			},
		];
	},
};

export default nextConfig;
