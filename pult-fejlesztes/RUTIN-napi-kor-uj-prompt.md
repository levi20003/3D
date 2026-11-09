# Napi kör: új lépés (ajánlati terv)

Ezt a pontot illeszd be a **3D - Napi kör (értesítéssel)** feladat promptjába, a „válaszok jelölése” lépés után:

> **Ajánlati terv az új válaszokra.** Minden `valaszolt` állapotú cégnél, amelynek nincs `offers/<doc_id>` dokumentuma és az elmúlt 14 napban válaszolt: olvasd el a Gmail-szálat (`get_thread`, PLAIN_TEXT, a `threadId` alapján; ha nincs, keresd `from:<domain>`-re), az utolsó bejövő levelet az idézett rész nélkül. Olvasd be a `settings/offerkit` dokumentumot (termékek, árak, tanulságok). Írd az `offers/<doc_id>` dokumentumba: `{intent: "talalkozo"|"arajanlat"|"kerdes"|"tovabbitva", summary, replyTo (a válaszoló címe, pl. sales@…), bring: [vinni való minták], custom (egyedi/logós minta), pricing, questions: [], tips: [], draft: {subject: "RE: …", body}, via: "napi kör", threadId, createdAt (ISO), status: "uj", checked: []}`, a céghez pedig `status: "ajanlat"`, `offerAt: <ma>`.
> - Ha egyértelmű elutasítás („most nem aktuális”, „nem kérjük”): ne írj tervet, a cég legyen `lezarva`, a `note` végére: „Válaszolt: most nem kér”.
> - Ha automatikus válasz (szabadság, kézbesítési értesítés): ne írj tervet, a cég maradjon `elkuldve`, `autoReplyAt: <ma>`.
> - Levelet és piszkozatot **ne** küldj és ne hozz létre; a pult gombjaival Levente dönt.
> - Az értesítésbe: „N új ajánlati terv: <cégnevek>”.
