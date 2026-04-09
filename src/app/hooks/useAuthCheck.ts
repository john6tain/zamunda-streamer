'use client';
import {useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';

export function useAuthCheck() {
	const [authenticated, setAuthenticated] = useState<boolean | null>(null);
	const [mode, setMode] = useState<'auth' | 'direct' | 'public' | 'none'>('none');
	const router = useRouter();

	useEffect(() => {
		const checkAuth = async () => {
			const res = await fetch('/api/checkAuth');
			const data = await res.json();
			if (data.authenticated) {
				setAuthenticated(true);
				setMode((data.mode as 'auth' | 'direct' | 'public' | 'none') || 'none');
			} else {
				setAuthenticated(false);
				setMode('none');
				router.push('/login');
			}
		};

		checkAuth();
	}, [router]);

	return {authenticated, mode};
}
