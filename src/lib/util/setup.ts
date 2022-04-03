import { RedisCacheClient } from '#lib/redis-cache/RedisCacheClient';
import { loadTags } from '#utils/tags';
import { Doc } from 'discordjs-docs-parser';
import { config } from 'dotenv-cra';
import { fileURLToPath, URL } from 'node:url';

process.env.NODE_ENV ??= 'development';

Doc.setGlobalOptions({
	escapeMarkdownLinks: true
});

config({
	path: fileURLToPath(new URL('../../../.env', import.meta.url))
});

await loadTags();

export const redisCache = new RedisCacheClient();
