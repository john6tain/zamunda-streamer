import type {Metadata} from "next";
import {Geist, Geist_Mono} from "next/font/google";
import './globals.css';
import {AuthProvider} from "@/app/context/AuthContext";
import {ThemeProvider} from "@/components/theme-provider";
import {Toaster} from "sonner";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Zamunda Streamer",
	description: "Zamunda Streamer with Peerflix",
};

export default function RootLayout({
																		 children,
																	 }: Readonly<{
	children: React.ReactNode;
}>) {

	return (
		<html lang="en">
		<body
			className={`${geistSans.variable} ${geistMono.variable} antialiased`}
		><ThemeProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			disableTransitionOnChange
		>
			<AuthProvider>
				<div className="flex justify-center items-center min-h-screen">
					{children}
				</div>
				<Toaster  theme={'system'}/>
			</AuthProvider>
		</ThemeProvider>


		</body>
		</html>
	);
}
