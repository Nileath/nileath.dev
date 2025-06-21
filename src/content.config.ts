import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

const createColleciton = (name: string, pattern: string = '**/*.{md,mdx}') => defineCollection({
	loader: glob({ base: `./src/content/${name}`, pattern }),
	// Type-check frontmatter using a schema
	schema: z.object({
		title: z.string(),
		description: z.string(),
		// Transform string to Date object
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		heroImage: z.string().optional(),
		private: z.boolean().optional(),
		category: z.string(),
		tags: z.string().array(),
	}),
});

export const collections = {
	blog: createColleciton('blog'),
	vulnerabilities: createColleciton('vulnerabilities'),
	writeups: createColleciton('writeups')
};
