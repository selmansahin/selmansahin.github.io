import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';

export async function GET(context) {
	const maneviPosts = (await getCollection('manevi')).map((post) => ({
		...post.data,
		link: `/manevi/allahin-isimleri/${post.id}/`,
	}));

	const yapayZekaPosts = (await getCollection('yapay-zeka')).map((post) => ({
		...post.data,
		link: `/yapay-zeka/${post.id}/`,
	}));

	const yazilimPosts = (await getCollection('yazilim')).map((post) => ({
		...post.data,
		link: `/yazilim/${post.id}/`,
	}));

	const kitaplarPosts = (await getCollection('kitaplar')).map((post) => ({
		...post.data,
		link: `/kitaplar/${post.id}/`,
	}));

	const allItems = [...maneviPosts, ...yapayZekaPosts, ...yazilimPosts, ...kitaplarPosts]
		.sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());

	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: allItems,
	});
}
