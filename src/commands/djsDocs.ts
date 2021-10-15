import { inlineCode } from '@discordjs/builders';
import type { Snowflake } from 'discord-api-types/v9';
import { DjsDocsDevIcon, DjsDocsStableIcon } from '../lib/constants/emotes';
import type { FastifyResponse } from '../lib/types/Api';
import { buildSelectOption, fetchDocResult, fetchDocs } from '../lib/util/discordjs-docs';
import { errorResponse, interactionResponse, selectMenuResponse, sendJson } from '../lib/util/responseHelpers';

export async function djsDocs({ query, response, source, target }: DjsDocsParameters): Promise<FastifyResponse> {
	const doc = await fetchDocs(source);

	const singleResult = fetchDocResult({ source, doc, query, target });

	if (singleResult) {
		return sendJson(
			response,
			interactionResponse({
				content: singleResult,
				users: target ? [target] : []
			})
		);
	}

	const results = doc.search(query);
	if (results?.length) {
		return sendJson(
			response,
			selectMenuResponse({
				selectMenuOptions: results.map((r) => buildSelectOption(r, source === 'main')),
				customId: `docsearch|${target ?? ''}|${source}`,
				content: `${
					source === 'main' ? DjsDocsDevIcon : DjsDocsStableIcon
				} Could not find anything in the DiscordJS documentation for ${inlineCode(query)}. Select a similar search result to send instead:`
			})
		);
	}

	return sendJson(
		response,
		errorResponse({
			content: 'I was unable to find anything with the provided parameters.'
		})
	);
}

interface DjsDocsParameters {
	response: FastifyResponse;
	source: string;
	query: string;
	target: Snowflake;
}
