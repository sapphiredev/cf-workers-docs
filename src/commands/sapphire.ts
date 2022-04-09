import { FetchUserAgent } from '#constants/constants';
import { SapphireGemId } from '#constants/emotes';
import { envParseString } from '#env/utils';
import { RedisKeys } from '#lib/redis-cache/RedisCacheClient';
import type { AlgoliaSearchResult, DocsearchHit } from '#types/Algolia';
import { buildHierarchicalName, buildResponseContent } from '#utils/algolia-utils';
import { errorResponse } from '#utils/response-utils';
import { redisCache } from '#utils/setup';
import { getGuildIds } from '#utils/utils';
import { hideLinkEmbed, hyperlink, inlineCode, SlashCommandSubcommandBuilder } from '@discordjs/builders';
import { fetch, FetchMethods, FetchResultTypes } from '@sapphire/fetch';
import { cast, cutText, isNullishOrEmpty } from '@sapphire/utilities';
import {
	Command,
	InteractionArguments,
	RegisterCommand,
	RegisterSubCommand,
	RestrictGuildIds,
	type AutocompleteInteractionArguments,
	type TransformedArguments
} from '@skyra/http-framework';
import type { APIApplicationCommandOptionChoice } from 'discord-api-types/v10';
import he from 'he';
import { URLSearchParams } from 'node:url';

@RegisterCommand((builder) => builder.setName('sapphire').setDescription('Search Sapphire guide and documentation'))
@RestrictGuildIds(getGuildIds())
export class UserCommand extends Command {
	#algoliaUrl = new URL(`https://${envParseString('SAPPHIRE_DOCS_ALOGLIA_APPLICATION_ID')}-dsn.algolia.net/1/indexes/sapphirejs/query`);
	#docsResponseHeaderText = `${hyperlink('Sapphire', hideLinkEmbed('https://www.sapphirejs.dev'))} docs results:`;
	#guideResponseHeaderText = `${hyperlink('Sapphire', hideLinkEmbed('https://www.sapphirejs.dev'))} guide results:`;

	public override async autocompleteRun(_: never, args: AutocompleteInteractionArguments<Args>) {
		if (args.focused !== 'query' || isNullishOrEmpty(args.query) || isNullishOrEmpty(args.subCommand)) {
			return this.autocompleteNoResults();
		}

		const algoliaResponse = await this.fetchApi(cast<'docs' | 'guide'>(args.subCommand), args.query);

		const redisInsertPromises: Promise<'OK'>[] = [];
		const results: APIApplicationCommandOptionChoice[] = [];

		for (const [index, hit] of algoliaResponse.hits.entries()) {
			const hierarchicalName = buildHierarchicalName(hit.hierarchy);

			if (hierarchicalName) {
				redisInsertPromises.push(redisCache.insertFor60Seconds<DocsearchHit>(RedisKeys.Sapphire, args.query, index.toString(), hit));

				results.push({
					name: cutText(hierarchicalName, 100),
					value: `${RedisKeys.Sapphire}:${args.query}:${index}`
				});
			}
		}

		if (redisInsertPromises.length) {
			await Promise.all(redisInsertPromises);
		}

		return this.autocomplete({
			choices: results.slice(0, 19)
		});
	}

	@RegisterSubCommand(buildSubcommandBuilders('docs', 'Search the sapphire documentation'))
	@RegisterSubCommand(buildSubcommandBuilders('guide', 'Search the sapphire guide'))
	protected async sharedRun(_: never, { subCommand, query, target }: InteractionArguments<Args>): Promise<Command.Response> {
		const docsOrGuide = cast<'docs' | 'guide'>(subCommand);

		const [, queryFromAutocomplete, nthResult] = query.split(':');
		const hitFromRedisCache = await redisCache.fetch<DocsearchHit>(RedisKeys.Sapphire, queryFromAutocomplete, nthResult);

		const headerText = docsOrGuide === 'docs' ? this.#docsResponseHeaderText : this.#guideResponseHeaderText;

		if (hitFromRedisCache) {
			const hierarchicalName = buildHierarchicalName(hitFromRedisCache.hierarchy, true);

			if (hierarchicalName) {
				return this.message({
					content: buildResponseContent({
						content: hyperlink(hierarchicalName, hideLinkEmbed(hitFromRedisCache.url)),
						target: target?.user.id,
						headerText,
						icon: SapphireGemId
					})
				});
			}
		}

		const algoliaResponse = await this.fetchApi(docsOrGuide, queryFromAutocomplete ?? query, 5);

		if (!algoliaResponse.hits.length) {
			return this.message(
				errorResponse({
					content: `no results were found for ${inlineCode(queryFromAutocomplete ?? query)}`,
					allowed_mentions: {
						users: target?.user.id ? [target?.user.id] : []
					}
				})
			);
		}

		const results = algoliaResponse.hits.map(({ hierarchy, url }) =>
			he.decode(
				`• ${hierarchy.lvl0 ?? hierarchy.lvl1 ?? ''}: ${hyperlink(
					`${hierarchy.lvl2 ?? hierarchy.lvl1 ?? 'click here'}`,
					hideLinkEmbed(url)
				)}${hierarchy.lvl3 ? ` - ${hierarchy.lvl3}` : ''}`
			)
		);

		return this.message({
			content: buildResponseContent({
				content: results,
				target: target?.user.id,
				headerText,
				icon: SapphireGemId
			}),
			allowed_mentions: {
				users: target?.user.id ? [target?.user.id] : []
			}
		});
	}

	private async fetchApi(subCommand: 'docs' | 'guide', query: string, hitsPerPage = 20) {
		return fetch<AlgoliaSearchResult<'docsearch'>>(
			this.#algoliaUrl,
			{
				method: FetchMethods.Post,
				body: JSON.stringify({
					params: new URLSearchParams({
						facetFilters: [`guide:${subCommand === 'guide' ? 'true' : 'false'}`],
						hitsPerPage: hitsPerPage.toString(),
						query
					}).toString()
				}),
				headers: {
					'Content-Type': 'application/json',
					'X-Algolia-API-Key': envParseString('SAPPHIRE_DOCS_ALOGLIA_APPLICATION_KEY'),
					'X-Algolia-Application-Id': envParseString('SAPPHIRE_DOCS_ALOGLIA_APPLICATION_ID'),
					'User-Agent': FetchUserAgent
				}
			},
			FetchResultTypes.JSON
		);
	}
}

function buildSubcommandBuilders(name: 'docs' | 'guide', description: string) {
	return new SlashCommandSubcommandBuilder() //
		.setName(name)
		.setDescription(description)
		.addStringOption((builder) =>
			builder //
				.setName('query')
				.setDescription('The phrase to search for')
				.setRequired(true)
				.setAutocomplete(true)
		)
		.addUserOption((builder) =>
			builder //
				.setName('target')
				.setDescription('Who should I ping that should look at these results?')
		);
}

interface Args {
	query: string;
	target?: TransformedArguments.User;
}
