import { SlashCommandBuilder } from "@discordjs/builders";
import { thesaurus_components } from "../message-layout.js";
import { reactionCollector } from "../utils.js"
export const data = new SlashCommandBuilder()
    .setName("thesaurus")
    .setDescription("Get synonyms and antonymns of any word")
    .addStringOption((option) =>
        option
            .setName("word")
            .setRequired(true)
            .setDescription("select a word for a thesaurus lookup")
    );
export async function execute(
    interaction,
    query,
    thesaurus,
    thesaurus_selection,
    start
) {
    if (thesaurus.error) {
        if (!thesaurus.error.suggested) {
            await interaction.reply({
                content: thesaurus.error.message,
                ephemeral: true,
            });
            return;
        }
        const error_message = await interaction.reply({
            content: thesaurus.error.message,
            fetchReply: true,
        });
        console.log("Error finding thesaurus entry, created error message");
        const filter = (reaction, user) => {
            return (
                ["❌", "✅"].includes(reaction.emoji.name) &&
                user.id === interaction.user.id
            );
        };
        await error_message.react("❌");
        await error_message.react("✅");
        console.log("Added reactions");
        reactionCollector(
            error_message,
            interaction.user.id,
            filter,
            thesaurus_components
        );
    } else {
        const filter = (reaction, user) => {
            return (
                reaction.emoji.name === "❌" && user.id === interaction.user.id
            );
        };
        const message = await interaction.reply(
            await thesaurus_components(
                query,
                thesaurus,
                start,
                "",
                0,
                thesaurus_selection
            )
        );
        await message.react("❌");
        reactionCollector(
            message,
            interaction.user.id,
            filter,
            thesaurus_components
        );
    }
}
