import fetch from "node-fetch";
import didYouMean from "didyoumean2";

const fetch_all_defs = async (query) => {
    let suggested = false;
    const [wnik_defs, mw_defs] = await Promise.all([
        fetch(
            `https://api.wordnik.com/v4/word.json/${query}/definitions?limit=10&includeRelated=false&sourceDictionaries=wiktionary&useCanonical=false&includeTags=false&api_key=${process.env.WNIK_KEY}`
        )
            .then((wnik_res) => wnik_res.json())
            .then((data) => {
                if (data.statusCode === 404) return null;
                const formatted = [];
                data.forEach((elm) => {
                    const len = formatted.length;
                    if (elm.text.match(/<[^>]*>/g) !== null)
                        elm.text = elm.text.replace(/<[^>]*>/g, "");
                    if (
                        len !== 0 &&
                        elm.partOfSpeech === formatted[len - 1].fl
                    ) {
                        formatted[len - 1].defs.push(elm.text);
                        return;
                    }
                    formatted.push({
                        defs: [elm.text],
                        fl: elm.partOfSpeech,
                        date: "unknown date",
                        source_url: `https://en.wiktionary.org/wiki/${encodeURIComponent(
                            `${query}#${
                                elm.partOfSpeech[0].toUpperCase() +
                                elm.partOfSpeech.slice(1)
                            }`
                        )}`,
                    });
                });
                return formatted;
            }),
        fetch(
            `https://www.dictionaryapi.com/api/v3/references/collegiate/json/${query}?key=${process.env.MW_DICT_KEY}`
        )
            .then((mw_res) => mw_res.json())
            .then((data) => {
                if (data.length === 0 || data[0].hwi === undefined) {
                    suggested = data.length !== 0;
                    return `Couldn't find **${query}**${
                        suggested
                            ? `, did you mean ___**${didYouMean(
                                  query,
                                  data
                              )}**___?`
                            : "."
                    }`;
                }

                const formatted = data.flatMap((elm) => {
                    if (elm.hwi && elm.shortdef.length !== 0) {
                        const formatted_date =
                            elm.date === undefined
                                ? "unknown date"
                                : elm.date.replace(/\{[^()]*\}/g, "");
                        return {
                            defs: elm.shortdef,
                            fl: elm.fl,
                            date: formatted_date,
                            syls: elm.hwi.hw.replace(/\*/g, "·"),
                            offensive: elm.meta.offensive,
                            source_url: `https://www.merriam-webster.com/dictionary/${encodeURIComponent(
                                elm.hwi.hw.replace(/\*/g, "")
                            )}`,
                        };
                    }

                    return [];
                });
                return formatted;
            }),
    ]);
    return {
        Wordnik: wnik_defs,
        MW: mw_defs,
        not_found: typeof mw_defs === "string" && wnik_defs === null,
        suggestion: suggested,
    };
};
const fetch_thesaurus = async (query) => {
    const api_response = await fetch(
        `https://www.dictionaryapi.com/api/v3/references/thesaurus/json/${query}?key=${process.env.MW_THES_KEY}`
    );
    const data = await api_response.json();
    if (data.length === 0 || data[0].hwi === undefined)
        return {
            error: {
                message: `Couldn't find the word you were looking for${
                    data.length !== 0
                        ? `, did you mean ___**${didYouMean(query, data)}**___?`
                        : "."
                }`,
                suggested: data.length !== 0
            },
        };
    const formatted_result = data.map((entry) => {
        const headword = entry.hwi.hw.replace(/\*/g, "")
        return {
            hw: entry.hwi.hw.replace(/\*/g, "·"),
            fl: entry.fl,
            syns: (entry.meta.syns.length !== 0) ? entry.meta.syns : null,
            ants: (entry.meta.ants.length !== 0) ? entry.meta.ants : null,
            source_url: `https://www.merriam-webster.com/thesaurus/${encodeURIComponent(headword)}`
        }
    });
    return formatted_result;
};
const get_api_ping = async () => {
    let start_time = performance.now();
    await fetch(`https://api.wordnik.com/v4/word.json/test/definitions?limit=10&includeRelated=false&sourceDictionaries=wiktionary&useCanonical=false&includeTags=false&api_key=${process.env.WNIK_KEY}`)
    let end_time = performance.now()
    const wiktionary_time = parseInt(end_time - start_time)
    start_time = performance.now()
    await fetch(`https://www.dictionaryapi.com/api/v3/references/collegiate/json/test?key=${process.env.MW_DICT_KEY}`)
    end_time = performance.now()
    const mw_time = parseInt(end_time - start_time)

    return {
        wnik_perf: wiktionary_time,
        mw_perf: mw_time
    }
}
const clean_query = (query) => {
    return query.toLowerCase().replace(/[^0-9a-z/-\s]/gi, "");
};

//bit of a mess, can use some refactoring later
const handleCorrections = async (
    interaction,
    message,
    component_creator,
    commandName
) => {
    const restart_timer = performance.now();
    const unclean_query = message.content.substring(
        message.content.indexOf("_")
    );
    const new_query = unclean_query.replace(/[^0-9a-z/-\s]/gi, "");
    const new_entries = (commandName === 'define') ? await fetch_all_defs(new_query) : await fetch_thesaurus(new_query);
    let valid_selection = ""
    if(commandName === "define"){
        valid_selection = typeof new_entries.MW === "string" && new_entries.Wordnik !== null
            ? "Wordnik"
            : "MW";
    }
    else {
        valid_selection = "Synonyms"
    }
    await interaction.update(
        await component_creator(
            new_query,
            new_entries,
            restart_timer,
            "",
            0,
            valid_selection,
            "\n"
        )
    );

};
//bad? somewhat
const validate_user = (mention_string, members_list, roles_list, interaction_creator) => {
    const res = {message: null, error: null} 
    const match_list = mention_string.match(/<@.?[0-9]*?>/g);
    res.message = (match_list !== null) ? match_list.flatMap(match => {
        const cleaned_id = match.replace(/[^0-9]/g, "")
        if(members_list.get(cleaned_id) !== undefined || roles_list.get(cleaned_id) !== undefined)
            return match
        return []
    }) : null
    res.error = (res.message === null) ? `Couldn't find the user(s) you mentioned. Please keep in mind that you cannot mention @ everyone or @ here. <@${interaction_creator}>` : null
    return res
}

export {
    fetch_all_defs,
    fetch_thesaurus,
    clean_query,
    validate_user,
    handleCorrections,
    get_api_ping
};
