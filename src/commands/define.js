import { SlashCommandBuilder } from "@discordjs/builders";
import { reactionCollector, validate_user } from "../utils.js";
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
            const filter = (reaction, user) => {
                return ( 
                    reaction.emoji.name === "❌" &&
                    user.id === interaction.user.id
                );
            };
            
            const message = await interaction.reply(
                await define_components(query, defs, start, "", 0, currentDict, mention)
            );
            await message.react("❌");
            reactionCollector(
                message,
                interaction.user.id,
                filter,
                define_components
            );
        } else {
            // error message is currently set on the MW result object because it was simple and i am naive
            if (!defs.suggestion) {
                await interaction.reply({ content: defs.MW, ephemeral: true });
                return;
            }
            const error_message = await interaction.reply({
                content: defs.MW,
                fetchReply: true,
            });
            console.log("Error finding definitions, created error message");
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
                define_components
            );
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
