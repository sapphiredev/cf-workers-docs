import { MaxMessageLength } from '#constants/constants';
import { ExtractEmojiIdRegex, SapphireGemId } from '#constants/emotes';
import type { FastifyResponse } from '#types/Api';
import { errorResponse, selectMenuResponse, sendJson } from '#utils/responseHelpers';
import { tagCache } from '#utils/tags';
import { inlineCode } from '@discordjs/builders';
import type { APISelectMenuOption, Snowflake } from 'discord-api-types/v9';

export function searchTag({ response, query, target }: SearchTagParameters): FastifyResponse {
	const results: APISelectMenuOption[] = [];

	for (const [key, tag] of tagCache.entries()) {
		const foundKeyword = tag.keywords.find((s) => s.toLowerCase().includes(query));
		const isContentMatch = tag.content.toLowerCase().includes(query);
		if (foundKeyword || isContentMatch) {
			if (results.join(', ').length + tag.keywords.length + 6 < MaxMessageLength) {
				results.push({
					label: key,
					value: key,
					emoji: {
						id: ExtractEmojiIdRegex.exec(SapphireGemId)?.groups?.id
					}
				});
			}
		}
	}

	if (results.length) {
		return sendJson(
			response,
			selectMenuResponse({
				selectMenuOptions: results,
				customId: `tag|${target ?? ''}`,
				content: 'Select a tag to send:'
			})
		);
	}

	return sendJson(response, errorResponse({ content: `Could not find a tag with name or alias similar to ${inlineCode(query)}` }));
}

interface SearchTagParameters {
	response: FastifyResponse;
	query: string;
	target: Snowflake;
}
