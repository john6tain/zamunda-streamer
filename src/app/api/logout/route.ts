import {NextResponse} from 'next/server';
import axios from 'axios';
import {CookieJar} from 'tough-cookie';
import {wrapper} from 'axios-cookiejar-support'
import {getZamundaBaseUrlFromCookieHeader} from "@/lib/zamundaBaseUrl";

const cookieJar = new CookieJar();
const client = wrapper(axios.create({jar: cookieJar, withCredentials: true}));

export async function DELETE(req: Request) {
	const baseUrl = getZamundaBaseUrlFromCookieHeader(req.headers.get('cookie'));

	try {
		await client.get(`${baseUrl}/logout.php`, {
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			jar: cookieJar,
			withCredentials: true,
		});

		cookieJar.getCookiesSync(baseUrl);
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
