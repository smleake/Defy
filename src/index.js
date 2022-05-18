import { Client, Collection, Intents } from "discord.js";
import {
    clean_query,
    fetch_all_defs,
    fetch_thesaurus,
    handleCorrections,
} from "./utils.js";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import configs from "./config.json";
import { define_components, thesaurus_components } from "./message-layout.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const client = new Client({
    intents: [
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MESSAGE_TYPING,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        Intents.FLAGS.GUILDS,
    ],
    partials: ["CHANNEL", "MESSAGE", "REACTION"],
});
client.commands = new Collection();
const commandFiles = fs
    .readdirSync(path.resolve(__dirname, "commands"))
    .filter((file) => file.endsWith(".js"));
const cache = {};
const clearCache = () => {
    console.log("Clearing cache");
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
/* 
	need to devise a way to listen to old reactions in case the bot is dismounted or restarted for any reason.
	the best way i can think of is storing all of the bots messages in a key value pair so i can add collectors to them accordingly 
*/
client.on("messageReactionAdd", async (reaction, user) => {
    // When a reaction is received, check if the structure is partial

    if (reaction.partial) {
        // If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
        try {
            console.log("Message is partial");
            await reaction.fetch();
            await reaction.message.fetch();
            const message = reaction.message;
            const commandName = message.interaction.commandName;
            if (
                message.interaction !== null &&
                message.author.id === client.user.id &&
                user.id === message.interaction.user.id
            ) {
                if (reaction.emoji.name === "❌") message.delete();
                else if (reaction.emoji.name === "✅" && message.content !== "")
                    await handleCorrections(
                        message,
                        commandName === "define"
                            ? define_components
                            : thesaurus_components,
                        message.interaction.user.id,
                        commandName
                    );
            }
        } catch (error) {
            console.error(
                "Something went wrong when fetching the message:",
                error
            );
            return;
        }
    }
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
                    if (cache[query] && cache[query].defs) {
                        await command.execute(
                            interaction,
                            query,
                            cache[query].defs,
                            cache[query].currDict,
                            start
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
                                currDict: currentDict,
                            };
                        }
                        await command.execute(
                            interaction,
                            query,
                            defs,
                            currentDict,
                            start
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
    }

    if (interaction.isMessageComponent()) {
        try {
            const commandName = interaction.message.interaction.commandName;
            switch (commandName) {
                case "define": {
                    const [word, current_index, perf, dict, direction] = (
                        interaction.isSelectMenu()
                            ? interaction.values[0]
                            : interaction.customId
                    ).split("-");
                    const new_index =
                        direction === undefined // ???? valid
                            ? parseInt(current_index)
                            : direction === "next"
                            ? parseInt(current_index) + 1
                            : parseInt(current_index - 1);
                    if (cache[word] && cache[word].defs) {
                        interaction.update(
                            await define_components(
                                word,
                                cache[word].defs,
                                0,
                                perf,
                                new_index,
                                dict
                            )
                        );
                    } else {
                        // already a valid interaction so we know the inputs are going to valid (naive? maybe)
                        const defs = await fetch_all_defs(word);
                        cache[word] = {
                            ...cache[word],
                            defs: defs,
                            currDict: dict,
                        };
                        console.log(
                            `Cache has ${Object.keys(cache).length} entries`
                        );
                        interaction.update(
                            await define_components(
                                word,
                                cache[word].defs,
                                0,
                                perf,
                                new_index,
                                dict
                            )
                        );
                    }
                    break;
                }
                case "thesaurus": {
                    const [word, current_index, perf, selection, direction] = (
                        interaction.isSelectMenu()
                            ? interaction.values[0]
                            : interaction.customId
                    ).split("-");
                    /* 
                        if direction = undefined -> new index = current index
                        if direction = next -> new index = current index + 1
                        else -> new index = current index - 1
                        not readable at all tbh
                    */
                    const new_index =
                        direction === undefined // ???? valid
                            ? parseInt(current_index)
                            : direction === "next"
                            ? parseInt(current_index) + 1
                            : parseInt(current_index - 1);
                    if (cache[word] && cache[word].thes) {
                        await interaction.update(
                            await thesaurus_components(
                                word,
                                cache[word].thes,
                                0,
                                perf,
                                new_index,
                                selection
                            )
                        );
                    } else {
                        // valid word so dont have to check before inserting into cache
                        const thes = await fetch_thesaurus(word);
                        cache[word] = { ...cache[word], thes: thes };
                        await interaction.update(
                            await thesaurus_components(
                                word,
                                thes,
                                0,
                                perf,
                                new_index,
                                selection
                            )
                        );
                    }
                    break;
                }
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

client.login(configs.token);
