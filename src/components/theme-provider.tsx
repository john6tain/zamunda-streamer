"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

export function ThemeProvider({
																children,
																...props
															}: React.ComponentProps<typeof NextThemesProvider>) {
	const [mounted, setMounted] = React.useState(false)

	React.useEffect(() => {
		// Ensure the theme is applied only on the client side to avoid hydration mismatch
		setMounted(true)
	}, [])

	if (!mounted) {
		// Return a placeholder or nothing until the component is mounted
		return null
	}

	return (
		<NextThemesProvider {...props}>
			{children}
		</NextThemesProvider>
	)
}
