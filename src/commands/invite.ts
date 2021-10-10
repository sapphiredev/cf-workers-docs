import { bold, hideLinkEmbed, hyperlink } from '@discordjs/builders';
import type { APIInteractionResponse } from 'discord-api-types/v9';
import { DiscordApplicationId } from '../lib/util/env';
import { interactionResponse } from '../lib/util/responseHelpers';

export function invite(): APIInteractionResponse {
	return interactionResponse({
		content: `Add the Sapphire interaction to your server: ${bold(
			hyperlink(
				'click here',
				hideLinkEmbed(`https://discord.com/api/oauth2/authorize?client_id=${DiscordApplicationId}&scope=applications.commands`)
			)
		)}`,
		ephemeral: true
	});
}
