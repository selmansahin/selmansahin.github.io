import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const postSchema = ({ image }: { image: Function }) =>
	z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		heroImage: z.optional(image()),
	});

const manevi = defineCollection({
	loader: glob({ base: './src/content/manevi', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			category: z.string(),
			sira: z.number().optional(),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
		}),
});

const yapayZeka = defineCollection({
	loader: glob({ base: './src/content/yapay-zeka', pattern: '**/*.{md,mdx}' }),
	schema: postSchema,
});

const yazilim = defineCollection({
	loader: glob({ base: './src/content/yazilim', pattern: '**/*.{md,mdx}' }),
	schema: postSchema,
});

const kitaplar = defineCollection({
	loader: glob({ base: './src/content/kitaplar', pattern: '**/*.{md,mdx}' }),
	schema: postSchema,
});

export const collections = { manevi, 'yapay-zeka': yapayZeka, yazilim, kitaplar };
