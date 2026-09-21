package com.bagplease.entity.item

import java.util.Locale

/**
 * Story 9.6 / AR-E9-4 — the ONE store-name rule, and the server is its authority.
 *
 * An item carries a list of store names. Identity is the LOWERCASED key; the stored casing is
 * display data, which is why a casing-only edit still persists (`["Lidl"]` → `["LIDL"]`) while
 * `"lidl"` beside `"Lidl"` is one store, not two.
 *
 * Its own top-level object rather than a private helper on `ItemService`: `plugins/Migration.kt`
 * folds the legacy single-value `store` field through exactly this normalizer, and a copy that
 * drifted from the service's would let a migrated row hold a shape no save could produce.
 *
 * `lowercase(Locale.ROOT)` deliberately, never the default-locale overload: a Turkish-locale JVM
 * would key `"LIDL"` to `"lıdl"` and stop matching `"lidl"`. The frontend mirror in
 * `storeValue.ts` uses plain `toLowerCase()` for the same reason (never `toLocaleLowerCase`), so
 * the two agree; where they could still disagree, the server's answer is what renders.
 */
object StoreNames {

    private fun key(name: String) = name.trim().lowercase(Locale.ROOT)

    /**
     * Trim every name, drop the blanks, and collapse duplicate keys keeping the FIRST occurrence —
     * both its casing and its position. Internal whitespace is kept: `"Aldi Nord"` is a name, not a
     * typo. Applied once per `saveItem`, so create and update cannot diverge.
     */
    fun normalize(raw: List<String>): List<String> {
        val seen = LinkedHashMap<String, String>()
        for (name in raw) {
            val trimmed = name.trim()
            if (trimmed.isEmpty()) continue
            seen.putIfAbsent(key(trimmed), trimmed)
        }
        return seen.values.toList()
    }

    /**
     * One name per key for `itemStoreSuggestions`: the LOWEST name of each key by
     * (`lowercase`, then `compareTo`), sorted by that same pair — a total order, so the offered
     * chips do not reshuffle between two calls that saw the same data.
     *
     * It deliberately does NOT route through [normalize] first. `normalize` collapses a key to its
     * FIRST occurrence, which is a property of the order the caller happened to hand them over —
     * and this call site is the flattened stores of every item on a list, whose order is the
     * storage map's. Item A's `"lidl"` and item B's `"Lidl"` are one suggestion either way, but
     * only picking the minimum makes WHICH casing is offered independent of that map order.
     * (The spec's sketch called `normalize` here; that made `minWith` dead code and would have
     * answered `"lidl"` where the I/O matrix asks for `"Lidl"`. Recorded in the Spec Change Log.)
     */
    fun suggestions(raw: List<String>): List<String> =
        raw.map { it.trim() }
            .filter { it.isNotEmpty() }
            .groupBy(::key).values
            .map { group -> group.minWith(compareBy({ key(it) }, { it })) }
            .sortedWith(compareBy({ key(it) }, { it }))
}
