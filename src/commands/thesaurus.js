import { SlashCommandBuilder } from "@discordjs/builders";
import { thesaurus_components } from "../message-layout.js";
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
        await interaction.reply({
            content: thesaurus.error.message,
            components: [
                {
                    type: "ACTION_ROW",
                    components: [
                        {
                            type: "BUTTON",
                            style: "SUCCESS",
                            label: "Yes",
                            customId: "correction"
                        },
                        {
                            type: "BUTTON",
                            style: "DANGER",
                            label: "No",
                            customId: "delete-message"
                        }
                    ]
                }
            ],
            fetchReply: true,
        });
    } else {
       await interaction.reply(
            await thesaurus_components(
                query,
                thesaurus,
                start,
                "",
                0,
                thesaurus_selection
            )
        );
    }
}
