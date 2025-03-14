'use client';

import React, { createContext, useState, useContext, ReactNode } from 'react';

interface AuthContextType {
	isAuthenticated: boolean;
	setAuthenticated: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
};

interface AuthProviderProps {
	children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
	const [isAuthenticated, setAuthenticated] = useState<boolean>(false);

	return (
		<AuthContext.Provider value={{ isAuthenticated, setAuthenticated }}>
			{children}
		</AuthContext.Provider>
	);
};
