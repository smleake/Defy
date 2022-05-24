import { readdirSync } from 'fs';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import configs from './config.json';

const commands = [];
const commandFiles = readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = await import(`./commands/${file}`);
	commands.push(command.data.toJSON());
}
const rest = new REST({ version: '9' }).setToken(configs.token);

// for testing and deleting commands in test guild
// rest.get(Routes.applicationGuildCommands(configs.clientID, configs.guildID))
// 	.then(data => {
// 		const promises = [];
//         for (const command of data) {
//             const deleteUrl = `${Routes.applicationGuildCommands(configs.clientID, configs.guildID)}/${command.id}`;
//             promises.push(rest.delete(deleteUrl));
//         }
//         return Promise.all(promises);
// 	})
rest.put(Routes.applicationCommands(configs.clientID), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);