'use client';

import React, {useEffect, useState} from 'react';
import * as Accordion from "@radix-ui/react-accordion";
import {Input} from "@/components/ui/input";
import Cookies from "js-cookie";
import {DEFAULT_ZAMUNDA_BASE_URL, normalizeZamundaBaseUrl} from "@/lib/zamundaBaseUrl";

export default function SettingsAccordion() {
	const [urlOption, setUrlOption] = useState<'url1' | 'url2' | 'custom'>('url2');
	const [customUrl, setCustomUrl] = useState('');
	const url1 = DEFAULT_ZAMUNDA_BASE_URL;
	const url2 = 'https://zamunda.ch';
	const selectedUrl = urlOption === 'custom' ? customUrl : (urlOption === 'url1' ? url1 : url2);

	useEffect(() => {
		const cookieValue = Cookies.get('zamunda_base_url');
		const normalized = normalizeZamundaBaseUrl(cookieValue || url1);
		if (normalized === url1) {
			setUrlOption('url1');
			return;
		}
		if (normalized === url2) {
			setUrlOption('url2');
			return;
		}
		setUrlOption('custom');
		setCustomUrl(normalized);
	}, []);

	useEffect(() => {
		const normalized = normalizeZamundaBaseUrl(selectedUrl || url1);
		Cookies.set('zamunda_base_url', normalized, {sameSite: 'lax', path: '/'});
		if (urlOption === 'custom' && normalized !== customUrl) {
			setCustomUrl(normalized);
		}
	}, [customUrl, selectedUrl, url1, urlOption]);

	return (
		<Accordion.Root
			type="single"
			collapsible
			className="fixed top-4 right-4 w-full max-w-sm rounded-lg bg-white p-4 text-gray-900 shadow-lg dark:bg-gray-700 dark:text-gray-100"
		>
			<Accordion.Item value="settings" className="overflow-hidden rounded-lg">
				<Accordion.Header>
					<Accordion.Trigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-semibold tracking-wide hover:bg-gray-100/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-gray-600/60">
						<span className="truncate">{selectedUrl || 'Select URL'}</span>
						<span className="text-xs text-gray-500 dark:text-gray-300">Change</span>
					</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content className="px-3 pb-2 pt-3 text-sm data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
					<div className="space-y-3">
						<label className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1 hover:border-gray-200 dark:hover:border-gray-500">
							<input
								type="radio"
								name="base-url"
								checked={urlOption === 'url1'}
								onChange={() => setUrlOption('url1')}
							/>
							<span className="truncate">{url1}</span>
						</label>
						<label className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1 hover:border-gray-200 dark:hover:border-gray-500">
							<input
								type="radio"
								name="base-url"
								checked={urlOption === 'url2'}
								onChange={() => setUrlOption('url2')}
							/>
							<span className="truncate">{url2}</span>
						</label>
						<label className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1 hover:border-gray-200 dark:hover:border-gray-500">
							<input
								type="radio"
								name="base-url"
								checked={urlOption === 'custom'}
								onChange={() => setUrlOption('custom')}
							/>
							<span>Custom URL</span>
						</label>
						{urlOption === 'custom' && (
							<Input
								type="url"
								value={customUrl}
								onChange={(e) => setCustomUrl(e.target.value)}
								placeholder="https://your-url.com"
								className="h-9"
							/>
						)}
						<div className="text-xs text-gray-500 dark:text-gray-300">
							Selected: {selectedUrl || '—'}
						</div>
					</div>
				</Accordion.Content>
			</Accordion.Item>
		</Accordion.Root>
	);
}
