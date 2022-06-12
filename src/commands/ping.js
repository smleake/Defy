import { SlashCommandBuilder } from '@discordjs/builders';
import { get_api_ping } from '../utils.js';

export const data = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Get the latencies of all associated API\'s.');
export async function execute(interaction, api_ping) {
    const defy_ping = Math.abs(Date.now() - interaction.createdTimestamp)
    const api_latencies = await get_api_ping()
    interaction.reply({embeds: [{ 
        title: "Pong! 🏓",
        color: "#000000",
        fields: [
        {
            name: "__Wiktionary ping__",
            value: `${api_latencies.wnik_perf}ms`,
        },
        {
            name: "__Merriam Webster ping__",
            value: `${api_latencies.mw_perf}ms`,
        },
        {
            name: "__Defy ping__",
            value: `${defy_ping}ms`
        },
        {
            name: "__Discord API ping__",
            value: `${api_ping}ms`,
        }
        ]
    }]
});
}