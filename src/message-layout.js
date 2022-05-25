import { MessageEmbed } from "discord.js";

const trim = (text, length) =>
    text.length > length ? text.substring(0, length - 4) + "..." : text;
const define_components = async (
    word,
    definitions,
    start,
    perf,
    index,
    currentDict,
    mention
) => {
    // probably want to avoid something like this
    if (start > 0) {
        const end = performance.now();
        perf = `${end - start > 1 ? parseInt(end - start) : "< 1"}ms`
    }

    const message = {
        embeds: [
            new MessageEmbed()
                .setColor("#000000")
                .setTitle(
                    `**${word}** ${
                        definitions[currentDict][index].syls
                            ? `(_${definitions[currentDict][index].syls}_)`
                            : ""
                    }`
                )
                .setURL(definitions[currentDict][index].source_url)
                .setDescription(
                    `**${definitions[currentDict][index].fl} —** *from ${
                        definitions[currentDict][index].date
                    }${
                        definitions[currentDict][index].offensive
                            ? " (offensive)*"
                            : "*"
                    }`
                )
                .addField(
                    `__Definitions__`,
                    definitions[currentDict][index].defs
                        .map((def) => `⬩${def}`)
                        .join("\n")
                )
                .setFooter({
                    text: `Defy Version 1.0.0 • Query took: ${perf}`,
                    iconURL:
                        "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/VisualEditor_-_Icon_-_Open-book-2.svg/1024px-VisualEditor_-_Icon_-_Open-book-2.svg.png",
                }),
        ],
        components: [
            {
                type: "ACTION_ROW",
                components: [
                    {
                        type: "BUTTON",
                        style: "SECONDARY",
                        label: "Previous definition",
                        customId: `${word}=${index}=${perf}=${currentDict}=prev`,
                        disabled: index === 0,
                    },
                    {
                        type: "BUTTON",
                        style: "SECONDARY",
                        label: "Next definition",
                        customId: `${word}=${index}=${perf}=${currentDict}=next`,
                        disabled: index + 1 >= definitions[currentDict].length,
                    },
                ],
            },
            {
                type: "ACTION_ROW",
                components: [
                    {
                        type: "SELECT_MENU",
                        placeholder: "Select dictionary source",
                        customId: "select-dict",
                        options: Object.keys(definitions).flatMap((dict) => {
                            if (typeof definitions[dict] !== "object" || definitions[dict] === null)
                                return [];
                            return {
                                label:
                                    dict === "MW"
                                        ? "Merriam-Webster"
                                        : "Wiktionary",
                                value: `${word}=${0}=${perf}=${dict}`,
                                default: dict === currentDict,
                            };
                        }),
                    },
                ],
            },
            {
                type: "ACTION_ROW",
                components: [
                    {
                        type: "SELECT_MENU",
                        placeholder: "Select definition",
                        customId: "select-def",
                        options: definitions[currentDict].map((def, ind) => {
                            return {
                                label: `${ind + 1} - ${
                                    def.syls ? def.syls : word
                                } (${def.fl})`,
                                description: trim(def.defs.join(", "), 100),
                                value: `${word}=${ind}=${perf}=${currentDict}`,
                                default: ind === index,
                            };
                        }),
                    },
                ],
            },
        ],
        fetchReply: true,
        content: mention,
    };
    return message;
};
const thesaurus_components = async (
    word,
    thesaurus,
    start,
    perf,
    index,
    thes_selection
) => {
    if(thes_selection === "Antonyms" && thesaurus[index].ants === null)
        thes_selection = "Synonyms"
        
    if (start > 0) {
        const end = performance.now();
        perf = `${end - start > 1 ? parseInt(end - start) : "< 1"}ms${
            perf === "cached" ? " (cached result)" : ""
        }`;
    }
    const message = {
        embeds: [
            new MessageEmbed()
                .setColor("#000000")
                .setTitle(`${word} (*${thesaurus[index].hw}*)`)
                .setURL(thesaurus[index].source_url)
                .setDescription(`***${thesaurus[index].fl}***`)
                .addField(
                    `${
                        thes_selection === "Synonyms"
                            ? "___Synonyms___"
                            : "___Antonyms___"
                    }`,
                    thes_selection === "Synonyms"
                        ? trim(
                              thesaurus[index].syns
                                  .map((entry) => `⬩${entry.join(", ")}`)
                                  .join("\n"),
                              1024
                          )
                        : trim(
                              thesaurus[index].ants
                                  .map((entry) => `⬩${entry.join(", ")}`)
                                  .join("\n"),
                              1024
                          )
                )
                .setFooter({
                    text: `Defy Version 1.0.0 • Query took: ${perf}`,
                    iconURL:
                        "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/VisualEditor_-_Icon_-_Open-book-2.svg/1024px-VisualEditor_-_Icon_-_Open-book-2.svg.png",
                }),
        ],
        components: [
            {
                type: "ACTION_ROW",
                components: [
                    {
                        type: "BUTTON",
                        style: "SECONDARY",
                        label: "Previous",
                        customId: `${word}=${index}=${perf}=${thes_selection}=prev`,
                        disabled: index === 0,
                    },
                    {
                        type: "BUTTON",
                        style: "SECONDARY",
                        label: "Next",
                        customId: `${word}=${index}=${perf}=${thes_selection}=next`,
                        disabled: index + 1 >= thesaurus.length,
                    },
                ],
            },
            {
                type: "ACTION_ROW",
                components: [
                    {
                        type: "SELECT_MENU",
                        placeholder: "Select synonyms or antonyms",
                        customId: "select-syns-ants",
                        options: ["Synonyms", "Antonyms"].flatMap((select) => {
                            if (
                                thesaurus[index][
                                    select === "Synonyms" ? "syns" : "ants"
                                ] === null
                            )
                                return [];
                            return {
                                label: select,
                                value: `${word}=${index}=${perf}=${select}`,
                                default: select === thes_selection,
                            };
                        }),
                    },
                ],
            },
            {
                type: "ACTION_ROW",
                components: [
                    {
                        type: "SELECT_MENU",
                        placeholder: "Choose specific word",
                        customId: "select-specific",
                        options: thesaurus.map((elm, ind) => ({
                            label: `${ind + 1} - ${elm.hw} (${elm.fl})`,
                            value: `${word}=${ind}=${perf}=${thes_selection}`,
                            default: ind === index
                        }))
                    },
                ],
            },
        ],
        content: "\n",
        fetchReply: true
    };
    return message;
};

export { define_components, thesaurus_components };
