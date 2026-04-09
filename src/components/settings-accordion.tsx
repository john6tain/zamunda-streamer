'use client';

import React, {useEffect, useState} from 'react';
import * as Accordion from "@radix-ui/react-accordion";
import {Input} from "@/components/ui/input";
import Cookies from "js-cookie";
import {DEFAULT_ZAMUNDA_BASE_URL, normalizeZamundaBaseUrl} from "@/lib/zamundaBaseUrl";
import {usePathname, useRouter} from "next/navigation";

export default function SettingsAccordion() {
    const [urlOption, setUrlOption] = useState<'url1' | 'url2' | 'url3' | 'custom' | 'magnet'>('url2');
    const [customUrl, setCustomUrl] = useState('');
    const router = useRouter();
    const pathname = usePathname();
    const url1 = DEFAULT_ZAMUNDA_BASE_URL;
    const url2 = 'https://zamunda.ch';
    const url3 = 'https://zamunda.rip';
    const selectedUrl =
        urlOption === 'url1'
            ? url1
            : (urlOption === 'url2'
                ? url2
                : (urlOption === 'url3' ? url3 : customUrl));

    useEffect(() => {
        const directTorrentCookie = Cookies.get('direct_torrent_url');
        if (directTorrentCookie) {
            setUrlOption('magnet');
            setCustomUrl(directTorrentCookie);
            return;
        }

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
        if (normalized === url3) {
            setUrlOption('url3');
            return;
        }
        setUrlOption('custom');
        setCustomUrl(normalized);
    }, [url1, url2, url3]);

    useEffect(() => {
        if (urlOption === 'magnet') {
            if (customUrl.trim()) {
                Cookies.set('direct_torrent_url', customUrl.trim(), {sameSite: 'lax', path: '/'});
            }
            return;
        }

        Cookies.remove('direct_torrent_url', {path: '/'});
        const normalized = normalizeZamundaBaseUrl(selectedUrl || url1);
        Cookies.set('zamunda_base_url', normalized, {sameSite: 'lax', path: '/'});
        if (urlOption === 'custom' && normalized !== customUrl) {
            setCustomUrl(normalized);
        }
    }, [customUrl, selectedUrl, url1, urlOption]);

    useEffect(() => {
        if (urlOption === 'url3' && pathname === '/login') {
            router.push('/dashboard');
        }
    }, [pathname, router, urlOption]);

    const startDirectStream = () => {
        if (urlOption !== 'magnet') {
            return;
        }
        const value = customUrl.trim();
        if (!value) {
            return;
        }
        const isMagnet = value.startsWith('magnet:?');
        const isHttp = /^https?:\/\//i.test(value);
        if (!isMagnet && !isHttp) {
            return;
        }
        Cookies.set('direct_torrent_url', value, {sameSite: 'lax', path: '/'});
        router.push(`/dashboard?torrent=${encodeURIComponent(value)}&direct=1`);
    };

    return (
        <Accordion.Root
            type="single"
            collapsible
            className="fixed top-4 right-4 w-full max-w-sm rounded-lg bg-white p-4 text-gray-900 shadow-lg dark:bg-gray-700 dark:text-gray-100"
        >
            <Accordion.Item value="settings" className="overflow-hidden rounded-lg">
                <Accordion.Header>
                    <Accordion.Trigger
                        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-semibold tracking-wide hover:bg-gray-100/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-gray-600/60">
                        <span className="truncate">{selectedUrl || 'Select URL'}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-300">Change</span>
                    </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content
                    className="px-3 pb-2 pt-3 text-sm data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                    <div className="space-y-3">
                        <label
                            className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1 hover:border-gray-200 dark:hover:border-gray-500">
                            <input
                                type="radio"
                                name="base-url"
                                checked={urlOption === 'url1'}
                                onChange={() => setUrlOption('url1')}
                            />
                            <span className="truncate">{url1}</span>
                        </label>
                        <label
                            className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1 hover:border-gray-200 dark:hover:border-gray-500">
                            <input
                                type="radio"
                                name="base-url"
                                checked={urlOption === 'url2'}
                                onChange={() => setUrlOption('url2')}
                            />
                            <span className="truncate">{url2}</span>
                        </label>
                        <label
                            className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1 hover:border-gray-200 dark:hover:border-gray-500">
                            <input
                                type="radio"
                                name="base-url"
                                checked={urlOption === 'url3'}
                                onChange={() => setUrlOption('url3')}
                            />
                            <span className="truncate">{url3} (no login)</span>
                        </label>
                        <label
                            className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1 hover:border-gray-200 dark:hover:border-gray-500">
                            <input
                                type="radio"
                                name="base-url"
                                checked={urlOption === 'custom'}
                                onChange={() => setUrlOption('custom')}
                            />
                            <span>Custom URL</span>
                        </label>
                        <label
                            className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1 hover:border-gray-200 dark:hover:border-gray-500">
                            <input
                                type="radio"
                                name="base-url"
                                checked={urlOption === 'magnet'}
                                onChange={() => {
                                    setUrlOption('magnet');
                                    if (!customUrl.trim()) {
                                        setCustomUrl('magnet:?xt=urn:btih:ef330b39f4801d25b4245212e75a38634bfc856e');
                                    }
                                }}
                            />
                            <span>Direct Magnet/Torrent URL</span>
                        </label>
                        {(urlOption === 'custom' || urlOption === 'magnet') && (
                            <Input
                                type={urlOption === 'magnet' ? 'text' : 'url'}
                                value={customUrl}
                                onChange={(e) => setCustomUrl(e.target.value)}
                                placeholder={(urlOption === 'custom' && 'https://your-url.com') || 'magnet:?xt=urn:btih:ef330b39f4801d25b4245212e75a38634bfc856e'}
                                className="h-9"
                                onKeyDown={(e) => {
                                    if (urlOption === 'magnet' && e.key === 'Enter') {
                                        e.preventDefault();
                                        startDirectStream();
                                    }
                                }}
                            />
                        )}
                        <div className="text-xs text-gray-500 dark:text-gray-300">
                            Selected: {selectedUrl || '-'}
                        </div>
                    </div>
                </Accordion.Content>
            </Accordion.Item>
        </Accordion.Root>
    );
}

