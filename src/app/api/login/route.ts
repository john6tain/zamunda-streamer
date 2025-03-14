import {NextResponse} from 'next/server';
import axios from 'axios';
import qs from 'qs';
import {CookieJar} from 'tough-cookie';
import {wrapper} from 'axios-cookiejar-support'

const cookieJar = new CookieJar();
const client = wrapper(axios.create({jar: cookieJar, withCredentials: true}));

export async function POST(req: Request) {
	const {username, password} = await req.json();
	console.log({username, password})
	const formData = qs.stringify({
		username,
		password,
	});

	try {
		const response = await client.post('https://www.zamunda.net/takelogin.php', formData, {
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			jar: cookieJar,
			withCredentials: true,
		});

		const cookies = cookieJar.getCookiesSync('https://www.zamunda.net');
		if (!cookies.some(cookie => cookie.key === 'uid' || cookie.key === 'pass')) {
			return NextResponse.json({error: 'Login failed. Check credentials.'}, {status: 401});
		}

		const res = NextResponse.json({data: {message: 'Login successful'}}, {status: 200});

		cookies.forEach((cookie) => {
			res.headers.append('Set-Cookie', `${cookie.key}=${cookie.value}; Path=/; HttpOnly;`);
		});

		return res;

	} catch (error) {
		console.error("Login failed:", error);
		return NextResponse.json({error: "Failed to log in"}, {status: 500});
	}
}
