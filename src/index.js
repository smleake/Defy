import { Client, Collection, Intents } from "discord.js";
import {
    clean_query,
    fetch_all_defs,
    fetch_thesaurus,
    handleCorrections,
} from "./utils.js";
import { config } from "dotenv";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { define_components, thesaurus_components } from "./message-layout.js";
config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const client = new Client({
    intents: [
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MESSAGE_TYPING,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_PRESENCES,
    ],
    partials: ["CHANNEL", "MESSAGE", "REACTION"],
});
client.commands = new Collection();
const commandFiles = fs
    .readdirSync(path.resolve(__dirname, "commands"))
    .filter((file) => file.endsWith(".js"));
const cache = {};
const clearCache = () => {
    console.log(
        `Clearing cache of size ${
            Object.keys(cache).length
        } at ${new Date().toISOString()}`
    );
    for (const prop of Object.getOwnPropertyNames(cache)) {
        delete cache[prop];
    }
    return;
};
setInterval(clearCache, 1000 * 60 * 60 * 24); // clear cache every 24 hours (maybe i should make this shorter) to reduce storage capacity
for (const file of commandFiles) {
    const command = await import(`./commands/${file}`);
    // Set a new item in the Collection
    // With the key as the command name and the value as the exported module
    client.commands.set(command.data.name, command);
}
client.on("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// feel like this can be refactored to not have switch statements at all and keep command code in their respective files
client.on("interactionCreate", async (interaction) => {
    if (interaction.isCommand()) {
        const start = performance.now();
        const command = client.commands.get(interaction.commandName);
        // get interaction term and clean it within a RegEx
        if (!command) return;
        try {
            switch (interaction.commandName) {
                case "define": {
                    const query = clean_query(
                        interaction.options.getString("word")
                    );
                    if (query.length === 0)
                    {
                        interaction.reply({
                            content:
                                "Couldn't find the word you were looking for. Keep in mind that the only special characters allowed are hyphens.",
                            ephemeral: true,
                        });
                        return;
                    }
                        
                    const user_mention =
                        interaction.options.getString("mention");
                    if (cache[query] && cache[query].defs) {
                        const currentDict =
                            typeof cache[query].defs.MW === "string" &&
                            cache[query].defs.Wordnik !== null
                                ? "Wordnik"
                                : "MW";
                        await command.execute(
                            interaction,
                            {
                                query: query,
                                defs: cache[query].defs,
                                currentDict: currentDict,
                                start: start,
                                mention: user_mention
                            }
                        );
                    } else {
                        const defs = await fetch_all_defs(query);
                        const currentDict =
                            typeof defs.MW === "string" && defs.Wordnik !== null
                                ? "Wordnik"
                                : "MW";
                        if (!defs.not_found) {
                            cache[query] = {
                                ...cache[query],
                                defs: defs,
                            };
                        }
                        await command.execute(
                            interaction,
                            {
                                query: query,
                                defs: cache[query].defs,
                                currentDict: currentDict,
                                start: start,
                                mention: user_mention
                            }
                        );
                    }
                    break;
                }
                case "ping":
                    await command.execute(interaction, client.ws.ping);
                    break;
                case "thesaurus": {
                    const query = clean_query(
                        interaction.options.getString("word")
                    );

                    if (cache[query] && cache[query].thes) {
                        await command.execute(
                            interaction,
                            query,
                            cache[query].thes,
                            "Synonyms",
                            start
                        );
                    } else {
                        const thes = await fetch_thesaurus(query);
                        if (!thes.error)
                            cache[query] = { ...cache[query], thes: thes };

                        await command.execute(
                            interaction,
                            query,
                            thes,
                            "Synonyms",
                            start
                        );
                    }

                    break;
                }
            }
        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: "There was an error while executing this command.",
                ephemeral: true,
            });
        }
    } else if (
        interaction.isButton() &&
        (interaction.customId === "delete-message" ||
            interaction.customId === "correction")
    ) {
        const interaction_user = interaction.user.id;
        const initial_interaction_creator =
            interaction.message.interaction.user.id;
        if (interaction_user === initial_interaction_creator) {
            switch (interaction.customId) {
                case "delete-message": {
                    interaction.message.delete();
                    break;
                }
                case "correction": {
                    const interaction_message = interaction.message;
                    const command_name =
                        interaction_message.interaction.commandName;
                    const component_creator =
                        command_name === "define"
                            ? define_components
                            : thesaurus_components;
                    await handleCorrections(
                        interaction,
                        interaction_message,
                        component_creator,
                        command_name
                    );
                    break;
                }
            }
        } else
            interaction.reply({
                content: "This can only be done by the message creator.",
                ephemeral: true,
            });
    }
    // this can be refactored heavily, redundant code in define and thesauraus switch cases
    else if (interaction.isMessageComponent()) {
        try {
            const commandName = interaction.message.interaction.commandName;
            const cache_entry_key = commandName === "define" ? "defs" : "thes";
            const component_creator =
                commandName === "define"
                    ? define_components
                    : thesaurus_components;
            const fetch_entries =
                commandName === "define" ? fetch_all_defs : fetch_thesaurus;
            const interaction_type = interaction.isSelectMenu()
                ? interaction.values[0]
                : interaction.customId;
            //legacy support for when the bot used a hyphen as a tokenizer
            const [word, current_index, perf, entry_type, direction] =
                interaction_type.split(
                    `${interaction_type.includes("=") ? "=" : "-"}`
                );
            const new_index =
                direction === undefined // ???? valid
                    ? parseInt(current_index)
                    : direction === "next"
                    ? parseInt(current_index) + 1
                    : parseInt(current_index - 1);
            if (cache[word] && cache[word][cache_entry_key]) {
                interaction.update(
                    await component_creator(
                        word,
                        cache[word][cache_entry_key],
                        0,
                        perf,
                        new_index,
                        entry_type
                    )
                );
            } else {
                // already a valid interaction so we know the inputs are going to valid (naive? maybe)
                const entries = await fetch_entries(word);
                cache[word] = {
                    ...cache[word],
                    [cache_entry_key]: entries,
                };
                console.log(`Cache has ${Object.keys(cache).length} entries`);
                interaction.update(
                    await component_creator(
                        word,
                        cache[word][cache_entry_key],
                        0,
                        perf,
                        new_index,
                        entry_type
                    )
                );
            }
        } catch (error) {
            console.log(error);
            await interaction.reply({
                content:
                    "There was a problem with this interaction. Please try again.",
                ephemeral: true,
            });
        }
    }
});

client.login(process.env.DISC_TOKEN);
