'use client';
import {useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';

export function useAuthCheck() {
	const [authenticated, setAuthenticated] = useState<boolean | null>(null);
	const router = useRouter();

	useEffect(() => {
		const checkAuth = async () => {
			const res = await fetch('/api/checkAuth');
			const data = await res.json();
			if (data.authenticated) {
				setAuthenticated(true);
				router.push('/dashboard');
			} else {
				setAuthenticated(false);
				router.push('/login');
			}
		};

		checkAuth();
	}, [router]);

	return {authenticated};
}
