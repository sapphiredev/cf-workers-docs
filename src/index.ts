process.env.NODE_ENV ??= 'development';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
	APIApplicationCommandInteraction,
	APIInteraction,
	ApplicationCommandInteractionDataOptionInteger,
	ApplicationCommandInteractionDataOptionString,
	ApplicationCommandInteractionDataOptionUser,
	InteractionResponseType,
	InteractionType,
	Snowflake
} from 'discord-api-types/v8';
import { config } from 'dotenv-cra';
import { join } from 'path';
import { djsDocs } from './commands/djsDocs';
import { invite } from './commands/invite';
import { ping } from './commands/ping';
import { cast } from './lib/constants';
import { HttpCodes } from './lib/HttpCodes';
import { verifyDiscordInteraction } from './lib/verifyDiscordInteraction';

config({
	path: process.env.NODE_ENV === 'production' ? join(__dirname, '.env') : join(__dirname, '..', '.env')
});

export default (req: VercelRequest, res: VercelResponse): VercelResponse => {
	const interactionInvalid = verifyDiscordInteraction(req);
	if (interactionInvalid) {
		return res.status(interactionInvalid.statusCode).json({ message: interactionInvalid.message });
	}

	const json = cast<APIInteraction>(req.body);

	if (json.type === InteractionType.Ping) return res.json({ type: InteractionResponseType.Pong });

	const {
		data: { id, options, name }
	} = cast<APIApplicationCommandInteraction>(json);

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

		switch (name) {
			// case 'docs':
			// 	return sapphireDocs(res, args.source ?? 'framework#latest', args.query, args.target);
			// case 'guide':
			// 	return sapphireGuide(res, args.query, args.results ?? 2, args.target);
			case 'djs':
				return djsDocs({
					response: res,
					source: cast<string>(args.source ?? 'stable'),
					query: cast<string>(args.query),
					target: cast<Snowflake>(args.target)
				});
			// TODO: Impl
			// case 'djs-guide':
			// 	return djsGuide(res, args.query, args.results ?? 2, args.target);
			// case 'mdn':
			// 	return mdnSearch(res, args.query, args.target);
			// case 'node':
			// 	return nodeSearch(res, args.query, args.target);
		}
	}

	switch (name) {
		case 'ping':
			return res.json(ping(id));
		case 'invite':
			return res.json(invite());
	}

	return res.status(HttpCodes.NotFound).json({ message: 'Not Found' });
};
