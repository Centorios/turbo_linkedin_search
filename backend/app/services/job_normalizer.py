import hashlib
import re
import unicodedata

from app.models.jobs import MAX_DESCRIPTION_CHARS, AlternateUrl, JobListing

PARTIAL_DESCRIPTION_MIN_CHARS = 200


def _normalize_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value or "")
    without_accents = "".join(c for c in decomposed if not unicodedata.combining(c))
    no_punctuation = re.sub(r"[^a-z0-9\s]", " ", without_accents.lower())
    return re.sub(r"\s+", " ", no_punctuation).strip()


def dedup_key(title: str, company: str, location: str) -> str:
    raw = "|".join(_normalize_text(part) for part in (title, company, location))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def listing_dedup_key(listing: JobListing) -> str:
    return dedup_key(listing.title, listing.company, listing.location)


def is_partial_description(description: str | None) -> bool:
    if not description:
        return True
    text = description.strip()
    return len(text) < PARTIAL_DESCRIPTION_MIN_CHARS or text.endswith(("...", "…"))


def _source_label(listing: JobListing) -> str:
    return listing.sources[0] if listing.sources else listing.source


def _best_description(a: JobListing, b: JobListing) -> JobListing:
    return b if len(b.description or "") > len(a.description or "") else a


def merge_listings(primary: JobListing, other: JobListing) -> JobListing:
    """Fusiona dos ofertas duplicadas: conserva la descripción más larga y los enlaces de ambas fuentes."""
    best = _best_description(primary, other)
    description = (best.description or None)
    if description:
        description = description[:MAX_DESCRIPTION_CHARS]

    sources = list(dict.fromkeys([*(primary.sources or [primary.source]), *(other.sources or [other.source])]))
    alternates = list(primary.alternateUrls)
    known_urls = {primary.url, *(alt.url for alt in alternates)}
    candidates = [AlternateUrl(source=_source_label(other), url=other.url), *other.alternateUrls]
    for alt in candidates:
        if alt.url not in known_urls:
            alternates.append(alt)
            known_urls.add(alt.url)

    return primary.model_copy(
        update={
            "description": description,
            "descriptionIsPartial": is_partial_description(description),
            "snippet": best.snippet or primary.snippet,
            "sources": sources,
            "alternateUrls": alternates,
        }
    )


def deduplicate_listings(listings: list[JobListing]) -> list[tuple[str, JobListing]]:
    """Devuelve pares (dedup_key, oferta) sin duplicados, respetando el orden de aparición."""
    merged: dict[str, JobListing] = {}
    for listing in listings:
        key = listing_dedup_key(listing)
        merged[key] = merge_listings(merged[key], listing) if key in merged else listing
    return list(merged.items())
