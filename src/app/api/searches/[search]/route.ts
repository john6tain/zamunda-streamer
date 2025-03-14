import axios from 'axios';
import iconv from 'iconv-lite';
import {JSDOM} from 'jsdom';
import {NextResponse} from "next/server";
import {CookieJar} from "tough-cookie";
import {wrapper} from "axios-cookiejar-support";

const cookieJar = new CookieJar();
const client = wrapper(axios.create({jar: cookieJar, withCredentials: true}));

export async function GET(req: Request, context: { params: { search: string } }) {
	try {
		const {searchParams} = new URL(req.url);
		const {search} = await context.params;
		const page = searchParams.get('page');
		console.log("kor")
		console.log(decodeURIComponent(search));
		const url = `https://www.zamunda.net/bananas?c5=1&c19=1&c20=1&c24=1&c25=1&c28=1&c31=1&c35=1&c42=1&c46=1&c7=1&c33=1&c55=1&search=${(decodeURIComponent(search).replace(/\s/g,'+'))}&gotonext=1&incldead=&field=name${page && ('&page=' + page) || ''}`;
		const cookies = req.headers.get('cookie');
		if (cookies) {
			cookies.split(';').forEach(cookie => {
				cookieJar.setCookie(cookie, 'https://www.zamunda.net');
			});
		}
		const response = await client.get(url, {
			withCredentials: true,
			responseType: 'arraybuffer',
		});

		const decodedData = iconv.decode(response.data, 'win1251');
		const dom = new JSDOM(decodedData);

		const document = dom.window.document;

		const parsedData = [...document.querySelectorAll('tr>td>a>b')].map(el => ({
			name: el.innerHTML,
			link: 'https://www.zamunda.net' + el.parentElement.parentElement.querySelectorAll('.imdrating div a')[0].href,
			image: 'https://www.zamunda.net' + el.parentElement.getAttribute('onmouseover').match(/src*=\\*'(.+?)'/g)[0].replace(`src=\\'`, '').replace(`\\'`, '') || '',
			size: el.parentElement.parentElement.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.innerHTML.replace('<br>', ' '),
			downloaded: el.parentElement.parentElement.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.innerHTML.replace('<br>', ' '),
			seed: el.parentElement.parentElement.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.querySelector('font,span').innerHTML.replace('<br>', ' '),
			icon1: el.parentElement.nextElementSibling?.src,
			icon2: el.parentElement.nextElementSibling.nextElementSibling?.src
		}));
		return NextResponse.json({
			tableData: parsedData,
			pages: document.querySelectorAll('font.red a b').length && Math.round(Number([...document.querySelectorAll('font.red a b')].pop().innerHTML.replace(/&nbsp;/g, '').split('-')[1]) / 20)
		}, {status: 200});

	} catch (error) {
		console.error('Error fetching data:', error);
		return NextResponse.json({error: 'Failed to fetch data'}, {status: 500});
	}
}

