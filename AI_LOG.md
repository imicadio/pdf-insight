# AI_LOG

## Narzędzia

- **Claude Code** (model Claude Opus 5.5) — analiza briefu, plan, generowanie kodu, testy, przegląd.
- **Claude in Chrome** — test demo w przeglądarce i zrzut ekranu.
- Dokumentacja Anthropic SDK (structured outputs, typy beta) sprawdzana bezpośrednio w `node_modules/@anthropic-ai/sdk`.

## Kluczowe prompty

1. **Analiza i plan** — „Dostałem zadanie rekrutacyjne, przeanalizuj dokładnie, stwórz plan działania” + pełny brief. Wynik: plan z decyzjami (ekstrakcja w przeglądarce, Vercel + Claude, wspólny schemat Zod), kolejnością prac i ryzykami dyskwalifikacji.
2. **Wybór stacku** — pytania doprecyzowujące od AI (backend, dostawca LLM, nazwa repo); wybrałem Vercel Functions, Claude i repo `imicadio/pdf-insight`.
3. **Schemat i walidacja** — „Schemat Zod zgodny z sekcją 04 briefu: daty ISO 8601, waluty ISO 4217, 3–5 zdań, 3–7 punktów; testy Vitest dla przypadków brzegowych”.
4. **Backend** — „Vercel Function: CORS z allowlisty, rate limit, walidacja body, Claude ze structured outputs, 1 ponowna próba z błędami walidacji, odporność na prompt injection, chunking długich dokumentów”.
5. **UI** — „Stany: pusty, ładowanie z krokami, błąd z ponowieniem, wynik; komunikaty po polsku, klawiatura, kontrast, od 360 px”.

## Gdzie AI się pomyliło i jak to poprawiłem

| Problem                                                                                                                                                                                            | Poprawka                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lista skrótów w liczniku zdań zawierała „r.”, „zł”, „o.o.” — w polszczyźnie często kończą zdanie („…od 1 października 2026 r. Termin…”), więc poprawne podsumowania byłyby odrzucane.              | Zostawiłem tylko skróty, które nigdy nie kończą zdania (np., tj., ul., nr…). Test z „2026 r.” w środku tekstu.                                   |
| Reguła „pojedyncza litera + kropka = inicjał” łapała też małe „r.” (rok).                                                                                                                          | Inicjał = tylko wielka litera (`\p{Lu}`). Błąd wykrył test Vitest.                                                                               |
| Pierwsza wersja zakładała `client.messages.parse()` z SDK. Ten helper rzuca wyjątek przy niezgodności ze schematem i gubi surową odpowiedź, a jest ona potrzebna do ponownej próby z listą błędów. | `messages.create()` z `output_config.format` (JSON Schema z Zod) + własna walidacja `safeParse` i retry z poprzednią odpowiedzią w historii.     |
| Założenie, że structured outputs wymuszą wszystkie ograniczenia schematu. Wygenerowany JSON Schema pokazał, że `minItems`, `pattern` i `enum` SDK przenosi do opisów pól.                          | Podwójna walidacja Zod (backend + przeglądarka) jest obowiązkowa, nie opcjonalna.                                                                |
| pdf.js był importowany statycznie — pierwszy bundle miał ~750 kB.                                                                                                                                  | Dynamiczny `import('../lib/pdf')` przy pierwszej analizie; `PdfError` wydzielony do osobnego modułu, żeby nie ciągnąć pdf.js do głównego bundla. |
| W regexie normalizacji tekstu wstawiony został dosłowny znak NBSP zamiast ` ` (ESLint `no-irregular-whitespace`).                                                                                  | Zamiana na sekwencję ` `.                                                                                                                        |
| Scaffold Vite nie miał `"strict": true` w `tsconfig`, a `.gitignore` nie ignorował `.env` — łatwo przeoczyć, a brief wymaga obu.                                                                   | Strict + `noUncheckedIndexedAccess` we wszystkich tsconfigach, `.env*` w `.gitignore` przed pierwszym commitem.                                  |

## Jak weryfikowałem kod

- Testy jednostkowe: schemat (poprawne/niepoprawne dane, null/[]), liczenie zdań, chunking, merge, handler HTTP (CORS, 400/413/429/500), neutralizacja tagu `</document>`.
- Ręczny smoke test lokalnego API `curl`-em: obcy origin → 403, preflight → 204, zły body → 400, szósta próba w minucie → 429.
- Testy na prawdziwych PDF-ach na demo (faktura, umowa, raport EN, długi dokument, skan, PDF z próbą prompt injection).
