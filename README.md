# PDF Insight

Aplikacja webowa, która wczytuje PDF, tworzy krótkie podsumowanie i zamienia treść w uporządkowane dane JSON.

**Demo:** https://imicadio.github.io/pdf-insight/

![Zrzut ekranu PDF Insight](docs/screenshot.png)

## Jak to działa

1. **Wgranie PDF** — drag & drop lub wybór pliku. Walidacja: tylko PDF (typ + nagłówek `%PDF-`), maks. 10 MB.
2. **Odczyt tekstu** — w przeglądarce, przez `pdfjs-dist`. Plik PDF nie opuszcza urządzenia.
3. **Analiza AI** — sam tekst trafia do backendu (Vercel Function), który wywołuje Claude (Anthropic) ze structured outputs.
4. **Wynik** — podsumowanie, kluczowe punkty, podmioty, kwoty, daty, słowa kluczowe, podgląd i pobranie `.json`. Ostatnie 10 wyników zostaje w `localStorage`.

## Architektura

```
GitHub Pages (React + Vite, statyczne pliki)
  │  pdf.js: PDF → tekst (w przeglądarce)
  │  POST { fileName, pages, text }
  ▼
Vercel Function  api/analyze.ts
  │  CORS (allowlista) → rate limit → walidacja body (Zod)
  │  krótki tekst: 1 wywołanie · długi: fragmenty równolegle + reduce + merge
  │  walidacja odpowiedzi (Zod) → 1 ponowna próba → błąd
  ▼
Anthropic API (claude-opus-5-5, effort: low, structured outputs)
```

```
src/
  components/  widoki: Dropzone, AnalysisProgress, ErrorState, ResultView, JsonPreview, HistoryPanel…
  hooks/       useAnalysis — maszyna stanów: idle → reading → analyzing → done | error
  lib/         schema.ts (Zod, wspólny z backendem), pdf.ts, history.ts, download.ts, format.ts
  api/         client.ts — wywołanie API, timeout, walidacja wyniku
api/           analyze.ts — Vercel Function (POST/OPTIONS)
server/        handler, prompt, claude (SDK + retry), chunk/merge, cors, rateLimit, dev.ts
```

## Decyzje

| Decyzja                                                     | Powód                                                                                                                                                                                                                |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ekstrakcja tekstu w przeglądarce                            | Limit body w Vercel Functions to 4,5 MB, a PDF może mieć 10 MB. Wysyłamy tylko tekst — szybciej, taniej, a plik zostaje u użytkownika.                                                                               |
| `fileName` i `pages` ustawia aplikacja, nie model           | To dane znane deterministycznie; model nie ma ich „zgadywać”.                                                                                                                                                        |
| Structured outputs + osobna walidacja Zod                   | JSON Schema wymusza kształt, ale nie wyrazi wszystkich reguł (3–5 zdań, 3–7 punktów, ISO 4217, poprawne daty). Te sprawdza Zod — na backendzie i ponownie w przeglądarce przed wyświetleniem.                        |
| 1 ponowna próba z listą błędów walidacji                    | Zgodnie z briefem; model dostaje konkretne błędy (np. `amounts.0.currency: Waluta musi być kodem ISO 4217`), co zwykle wystarcza.                                                                                    |
| `claude-opus-5-5` z `effort: "low"`                         | Ekstrakcja nie wymaga głębokiego rozumowania; niski effort trzyma czas odpowiedzi w limicie 30 s. Model można zmienić zmienną `ANTHROPIC_MODEL`. Włączony serwerowy fallback modelu na wypadek odmowy klasyfikatora. |
| Wspólny schemat `src/lib/schema.ts`                         | Jedno źródło prawdy dla frontendu, backendu i testów.                                                                                                                                                                |
| Daty ISO 8601 z precyzją dnia, miesiąca lub roku            | Gdy dokument podaje „wrzesień 2026”, model zapisuje `2026-09` zamiast zgadywać dzień.                                                                                                                                |
| Długie dokumenty: map → reduce → deterministyczny merge     | Fragmenty (~60 tys. znaków) analizowane równolegle; podsumowanie całości robi jedno dodatkowe wywołanie, a listy (podmioty, kwoty, daty, słowa kluczowe) są łączone i deduplikowane w kodzie.                        |
| Jedna strona bez routera                                    | Brak routingu = brak problemu z 404 na GitHub Pages; `base: '/pdf-insight/'` w `vite.config.ts`.                                                                                                                     |
| Worker pdf.js przez `import …?url`, pdf.js ładowany leniwie | Poprawna ścieżka do workera pod `base` i mniejszy pierwszy bundle.                                                                                                                                                   |

## Bezpieczeństwo

- Klucz `ANTHROPIC_API_KEY` istnieje wyłącznie w zmiennych środowiskowych Vercel. Frontend zna tylko publiczny `VITE_API_URL`. `.env` jest w `.gitignore`.
- CORS: tylko originy z `ALLOWED_ORIGINS` (demo + localhost); żądania z innych originów (lub bez nagłówka `Origin`) dostają 403, zanim cokolwiek trafi do AI.
- Limity w dwóch warstwach: **Vercel Firewall** (reguła rate limit na `POST /api/analyze`, liczona na brzegu, zanim żądanie dotrze do funkcji) oraz limiter w funkcji: 5 analiz/min i 30/dzień na IP, 500/dzień globalnie (w pamięci instancji; opcjonalnie współdzielony przez Upstash Redis). Do tego body ≤ 4 MB, tekst ≤ 600 tys. znaków, plik ≤ 10 MB i limit wydatków w Anthropic Console.
- Prompt injection: treść PDF jest w znacznikach `<document>` jako dane (zamykający tag w treści jest neutralizowany), system prompt każe ignorować polecenia z dokumentu, model nie ma narzędzi, a wynik jest ograniczony schematem i walidowany.
- Brak `dangerouslySetInnerHTML` — wszystko renderowane jako tekst przez React. Błędy serwera nie ujawniają szczegółów.
- Interfejs informuje, że tekst trafia do zewnętrznego API AI.

## Uruchomienie lokalne

Wymagania: Node.js 20+.

```bash
npm ci
cp .env.example .env        # uzupełnij ANTHROPIC_API_KEY
npm run dev:api             # API na http://localhost:3000/api/analyze
npm run dev                 # frontend na http://localhost:5173/pdf-insight/
```

| Skrypt                            | Opis                                   |
| --------------------------------- | -------------------------------------- |
| `npm run lint` / `npm run format` | ESLint / Prettier                      |
| `npm run typecheck`               | TypeScript strict (frontend + backend) |
| `npm test`                        | Testy jednostkowe (Vitest)             |
| `npm run build`                   | Typecheck + build produkcyjny          |

### Zmienne środowiskowe

| Zmienna                                              | Gdzie                        | Opis                                                         |
| ---------------------------------------------------- | ---------------------------- | ------------------------------------------------------------ |
| `VITE_API_URL`                                       | GitHub Actions → Variables   | Publiczny adres backendu (np. `https://….vercel.app`)        |
| `ANTHROPIC_API_KEY`                                  | Vercel (sekret)              | Klucz Anthropic API                                          |
| `ANTHROPIC_MODEL`                                    | Vercel (opcjonalnie)         | Domyślnie `claude-opus-5-5`                                  |
| `ALLOWED_ORIGINS`                                    | Vercel                       | Np. `https://imicadio.github.io`                             |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Vercel (sekret), opcjonalnie | Współdzielony rate limit; bez nich limit w pamięci instancji |

## Deploy

- **Frontend:** push na `main` → GitHub Actions: lint → format check → testy → typecheck + build → GitHub Pages (Settings → Pages → Source: GitHub Actions).
- **Backend:** projekt Vercel podłączony do repozytorium (deployuje tylko `api/`, frontend nie jest budowany na Vercel — patrz `vercel.json`).

## Znane ograniczenia

- Skany bez warstwy tekstowej nie są obsługiwane (brak OCR) — aplikacja wyświetla czytelny komunikat.
- Bardzo długie dokumenty (powyżej ~480 tys. znaków) są analizowane tylko w początkowej części; wynik zawiera `meta.truncated: true` i ostrzeżenie w UI.
- Liczenie zdań w podsumowaniu jest heurystyczne (`Intl.Segmenter` + lista skrótów); nietypowe skróty mogą spowodować ponowną próbę.
- Tabele i układ wielokolumnowy PDF mogą zostać odczytane w nieoptymalnej kolejności — to ograniczenie warstwy tekstowej PDF.
- Wyniki generuje model AI i mogą zawierać błędy.
- Historia jest przechowywana tylko w `localStorage` tej przeglądarki.

## Format wyniku

Zgodny ze schematem z briefu; dodatkowo pole `meta` (`model`, `analyzedAt`, `chunks`, `truncated`). Przykład: [`docs/example.json`](docs/example.json).
