import { SlashCommandBuilder } from '@discordjs/builders';

export const data = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!');
export async function execute(interaction, api_ping) {
    await interaction.reply(`Bot latency is ${Math.abs(Date.now() - interaction.createdTimestamp)}ms. Discord API latency is ${api_ping}ms.`);
}