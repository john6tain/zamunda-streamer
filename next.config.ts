import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
	outputFileTracingRoot: path.join(__dirname),
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{ key: "Access-Control-Allow-Credentials", value: "true" },
					{ key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
					{ key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
				],
			},
		];
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "www.zamunda.net",
				port: "",
				pathname: "/**", // Allow all paths under this domain
			},
			{
				protocol: "https",
				hostname: "zamunda.net",
				port: "",
				pathname: "/**", // Allow all paths under this domain
			},
		],
	},
};

export default nextConfig;
