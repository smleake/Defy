import { SlashCommandBuilder } from "@discordjs/builders";
import { validate_user } from "../utils.js";
import { define_components } from "../message-layout.js";

export const data = new SlashCommandBuilder()
    .setName("define")
    .setDescription("Define any word")
    .addStringOption((option) =>
        option
            .setName("word")
            .setRequired(true)
            .setDescription("Select a word to define.")
    )
    .addStringOption((option) =>
        option
            .setName("mention")
            .setDescription("Optionally tag other users in the response.")
    )
export async function execute(interaction, query, defs, currentDict, start, mention) {
    try {
        if (!defs.not_found) {
            if(mention !== null) {
                const validate = validate_user(mention, interaction.channel.members, interaction.guild.roles.cache, interaction.user.id)
                mention = (validate.error === null) ? validate.message.join(" ") : validate.error
            }
            
            await interaction.reply(
                await define_components(query, defs, start, "", 0, currentDict, mention)
            );
           
        } else {
            // error message is currently set on the MW result object because it was simple and i am naive
            if (!defs.suggestion) {
                await interaction.reply({ content: defs.MW, ephemeral: true });
                return;
            }
            await interaction.reply({
                content: defs.MW,
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
            return true;
        }
    } catch (err) {
        console.log(err);
        interaction.reply({
            content:
                "There was an issue executing this command. Please try again.",
            ephemeral: true,
        });
    }
}
