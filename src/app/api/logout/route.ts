import {NextResponse} from 'next/server';
import axios from 'axios';
import {CookieJar} from 'tough-cookie';
import {wrapper} from 'axios-cookiejar-support'

const cookieJar = new CookieJar();
const client = wrapper(axios.create({jar: cookieJar, withCredentials: true}));

export async function DELETE(req: Request) {

	try {
		const response = await client.get('https://www.zamunda.net/logout.php', {
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			jar: cookieJar,
			withCredentials: true,
		});

		const cookies = cookieJar.getCookiesSync('https://www.zamunda.net');
		const res = NextResponse.json({message: 'Logout successful'}, {status: 200});
		const cookiesToDelete = [
			'russian_lang',
			'uid',
			'pass',
			'bitbucketz',
			'xporn',
			'cats',
			'periods',
			'statuses',
			'howmanys',
			'isconnected',
		];

		cookiesToDelete.forEach((cookie) => {
			res.headers.append('Set-Cookie', `${cookie}=deleted; expires=Thu, 01-Jan-1970 00:00:01 GMT; Max-Age=0; ; Path=/; HttpOnly;`);
		});

		return res;

	} catch (error) {
		console.error("Login failed:", error);
		return NextResponse.json({error: "Failed to log in"}, {status: 500});
	}
}
