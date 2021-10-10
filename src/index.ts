process.env.NODE_ENV ??= 'development';

import type { Awaitable } from '@sapphire/utilities';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
	APIChatInputApplicationCommandInteraction,
	APIInteraction,
	APIMessageSelectMenuInteractionData,
	ApplicationCommandInteractionDataOptionInteger,
	ApplicationCommandInteractionDataOptionString,
	ApplicationCommandInteractionDataOptionUser,
	InteractionResponseType,
	InteractionType,
	Snowflake
} from 'discord-api-types/v9';
import { config } from 'dotenv-cra';
import { join } from 'path';
import { djsDocs } from './commands/djsDocs';
import { djsGuide } from './commands/djsGuide';
import { githubSearch } from './commands/githubApi';
import { invite } from './commands/invite';
import { mdnSearch } from './commands/mdnDocs';
import { nodeSearch } from './commands/nodeDocs';
import { ping } from './commands/ping';
import { slashiesEta } from './commands/slashiesEta';
import { showTag } from './commands/tags';
import { verifyDiscordInteraction } from './lib/api/verifyDiscordInteraction';
import { cast, FailPrefix } from './lib/constants/constants';
import { errorResponse } from './lib/util/responseHelpers';
import { handleTagSelectMenu } from './select-menus/tag-menu';

config({
	path: process.env.NODE_ENV === 'production' ? join(__dirname, '.env') : join(__dirname, '..', '.env')
});

export default (req: VercelRequest, res: VercelResponse): Awaitable<VercelResponse> => {
	const interactionInvalid = verifyDiscordInteraction(req);
	if (interactionInvalid) {
		return res //
			.status(interactionInvalid.statusCode)
			.json({ message: interactionInvalid.message });
	}

	try {
		const json = cast<APIInteraction>(req.body);

		if (json.type === InteractionType.Ping) return res.json({ type: InteractionResponseType.Pong });

		if (json.type === InteractionType.ApplicationCommand) {
			const {
				id,
				data: { options, name }
			} = cast<APIChatInputApplicationCommandInteraction>(json);

			if (options?.length) {
				const args = Object.fromEntries(
					cast<
						Array<
							| ApplicationCommandInteractionDataOptionString
							| ApplicationCommandInteractionDataOptionUser
							| ApplicationCommandInteractionDataOptionInteger
						>
					>(options).map(({ name, value }) => [name, value])
				);

				switch (name as RegisteredSlashiesWithOptions) {
					case 'djs':
						return djsDocs({
							response: res,
							source: cast<string>(args.source ?? 'stable'),
							query: cast<string>(args.query).trim(),
							target: cast<Snowflake>(args.target)
						});
					case 'djs-guide':
						return djsGuide({
							response: res,
							query: cast<string>(args.query).trim(),
							amountOfResults: cast<number>(args.results ?? 2),
							target: cast<Snowflake>(args.target)
						});
					case 'mdn':
						return mdnSearch({
							response: res,
							query: cast<string>(args.query).trim(),
							target: cast<Snowflake>(args.target)
						});
					case 'node':
						return nodeSearch({
							response: res,
							query: cast<string>(args.query).trim(),
							version: cast<'latest-v12.x' | 'latest-v14.x' | 'latest-v16.x'>(args.version),
							target: cast<Snowflake>(args.target)
						});
					case 'github':
						return githubSearch({
							response: res,
							number: cast<number>(args.number),
							owner: cast<string>(args.owner ?? 'sapphiredev').trim(),
							repository: cast<string>(args.repository).trim(),
							target: cast<Snowflake>(args.target)
						});
					case 'tag':
						return showTag({
							response: res,
							query: cast<string>(args.query).trim().toLowerCase(),
							target: cast<Snowflake>(args.target)
						});
				}
			}

			switch (name as RegisteredSlashies) {
				case 'ping':
					return res.json(ping(id));
				case 'invite':
					return res.json(invite());
				case 'slashies-eta':
					return slashiesEta({
						response: res
					});
			}
		}

		if (json.type === InteractionType.MessageComponent) {
			const { token } = json;
			const { custom_id: customId, values: selected } = json.data as APIMessageSelectMenuInteractionData;
			const [op, target] = customId.split('|');

			switch (op as SelectMenuOpCodes) {
				case 'tag': {
					void handleTagSelectMenu({ response: res, selectedValue: selected[0], token, target });
					return res.status(200);
				}
			}
		}

		return res.json(
			errorResponse({
				content: `${FailPrefix} how did you get here? What magic data are you sending that your interaction type is not being recognised?`
			})
		);
	} catch (error) {
		return res.json(errorResponse({ content: `${FailPrefix} it looks like something went wrong here, please try again later!` }));
	}
};

type RegisteredSlashiesWithOptions = 'djs-guide' | 'djs' | 'mdn' | 'node' | 'github' | 'tag';
type RegisteredSlashies = 'ping' | 'invite' | 'slashies-eta';
type SelectMenuOpCodes = 'tag';
