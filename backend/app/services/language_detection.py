"""Detects the language a text is written in, without external dependencies.

It counts very frequent function words of each language. Content words (job
titles, technologies, company names) are often shared across languages, but
articles, prepositions and conjunctions are not. When the evidence is thin or
mixed it answers None: an empty section is better than a wrong language.
"""

import re
import unicodedata

MIN_WORDS = 8
# The winner needs at least this many matches and to beat the runner-up clearly.
MIN_MATCHES = 3
MIN_LEAD_RATIO = 1.5

_FUNCTION_WORDS: dict[str, frozenset[str]] = {
    "Español": frozenset(
        "de la el en y los las del con por para un una que se es su al lo como mas pero sus le ya o fue este "
        "entre desde sobre tambien hasta donde muy sin hay son ser tengo trabaje trabajo anos".split()
    ),
    "Inglés": frozenset(
        "the and of to in with for a an is was were at on as by from that this which are be or have has had "
        "my our their i it its into over also more built led worked experience".split()
    ),
    "Portugués": frozenset(
        "de a o e os as do da dos das em no na nos nas um uma para com por que se foi como mais mas seu sua "
        "ao aos tambem ate onde muito sem sao ser tenho trabalhei trabalho anos".split()
    ),
}


def _normalize(word: str) -> str:
    decomposed = unicodedata.normalize("NFKD", word.casefold())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def _words(text: str) -> list[str]:
    return [_normalize(match) for match in re.findall(r"[^\W\d_]+", text, flags=re.UNICODE)]


def detect_language(text: str) -> str | None:
    """Returns "Español", "Inglés" or "Portugués", or None when it is not clear."""
    words = _words(text)
    if len(words) < MIN_WORDS:
        return None

    # A word counts for a language only if it is not also a function word of another one.
    owners: dict[str, set[str]] = {}
    for language, vocabulary in _FUNCTION_WORDS.items():
        for word in vocabulary:
            owners.setdefault(word, set()).add(language)

    scores = {language: 0 for language in _FUNCTION_WORDS}
    for word in words:
        languages = owners.get(word)
        if languages and len(languages) == 1:
            scores[next(iter(languages))] += 1

    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    (best, best_score), (_, runner_up_score) = ranked[0], ranked[1]
    if best_score < MIN_MATCHES:
        return None
    if runner_up_score and best_score / runner_up_score < MIN_LEAD_RATIO:
        return None
    return best
