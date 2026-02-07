// app/login/page.tsx
'use client';

import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label";

import React, {useState} from 'react';
import {useRouter} from 'next/navigation';
import {apiPost} from "@/lib/apiService";
import {toast} from "sonner";
import {Spinner} from "@/components/ui/spinner";
import SettingsAccordion from "@/components/settings-accordion";

export default function LoginPage() {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const router = useRouter();
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		apiPost("/login", {username, password}).then(data => {
			console.log(data)
			toast.success('Login successful');
			router.push('/dashboard');
		}).catch(({error}) => {
			toast.error(error);
		});
	};

	return (
		<>
			<SettingsAccordion />
			<div className="w-full max-w-sm p-8 bg-white dark:bg-gray-700 rounded-lg shadow-lg">
			<h2 className="text-2xl font-bold text-center mb-6 text-white dark:text-gray-200">Login</h2>
			<form onSubmit={handleSubmit} className="space-y-4">
				<div>
					<Label htmlFor="username" className="block text-sm font-medium text-gray-300 dark:text-gray-200">
						Username
					</Label>
					<Input
						id="username"
						type="text"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						placeholder="Enter your username"
						className="w-full mt-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:bg-gray-600 dark:text-white"
					/>
				</div>
				<div>
					<Label htmlFor="password" className="block text-sm font-medium text-gray-300 dark:text-gray-200">
						Password
					</Label>
					<Input
						id="password"
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="Enter your password"
						className="w-full mt-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:bg-gray-600 dark:text-white"
					/>
				</div>
				<Button
					type="submit"
					className="w-full py-2 px-4 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500"
				>
					Login
				</Button>
			</form>
			</div>

		</>
	);
}
