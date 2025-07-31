# 🚀 Multi-Platform Hashtag Scraper

## 📋 Przegląd

Twój projekt został rozbudowany o obsługę **trzech platform**: TikTok, Instagram i YouTube! Teraz możesz zbierać dane z wszystkich platform jednocześnie lub osobno.

## 🌟 Nowe funkcje

### ✅ Obsługiwane platformy:

- **TikTok** - filmy z napisami
- **Instagram** - posty i reels
- **YouTube** - filmy (planowane: napisy)

### 🔧 Nowe endpointy API:

- `POST /run-scraper` - Wszystkie platformy naraz
- `POST /run-tiktok` - Tylko TikTok
- `POST /run-instagram` - Tylko Instagram
- `POST /run-youtube` - Tylko YouTube

### 📊 Nowa struktura danych:

- Dodane pole `platform` w Airtable
- Zachowana kompatybilność z obecnymi danymi

## 🚀 Jak używać

### 1. Automatyczne uruchamianie (cron)

Scraper automatycznie uruchamia się codziennie o 10:00 i pobiera dane ze wszystkich skonfigurowanych platform.

### 2. Ręczne uruchamianie

```bash
# Wszystkie platformy
curl -X POST http://localhost:3000/run-scraper

# Tylko TikTok
curl -X POST http://localhost:3000/run-tiktok

# Tylko Instagram
curl -X POST http://localhost:3000/run-instagram

# Tylko YouTube
curl -X POST http://localhost:3000/run-youtube
```

### 3. Z kodu

```javascript
const {
  runMultiPlatformScraper,
  runTikTokScraper,
  runInstagramScraper,
  runYouTubeScraper,
} = require("./index");

// Wszystkie platformy
await runMultiPlatformScraper();

// Pojedyncze platformy
await runTikTokScraper();
await runInstagramScraper();
await runYouTubeScraper();
```

## ⚙️ Konfiguracja platform

### W tabeli `hashtagSeries` w Airtable:

Dodaj nowe pole `platforms` (typ: tekst wielowierszowy) z listą platform oddzieloną przecinkami:

```
tiktok,instagram,youtube
```

**Przykłady konfiguracji:**

- `tiktok` - tylko TikTok
- `instagram,youtube` - Instagram i YouTube
- `tiktok,instagram,youtube` - wszystkie platformy

### Jeśli nie ustawisz pola `platforms`:

Domyślnie używa tylko TikTok (zachowana kompatybilność)

## 📁 Nowa struktura projektu

```
├── scrapers/
│   ├── tiktok.js      # Scraper TikTok
│   ├── instagram.js   # Scraper Instagram
│   └── youtube.js     # Scraper YouTube
├── platform-manager.js # Centralny manager
├── index.js           # Główne funkcje
├── server.js          # Serwer HTTP
└── create-table-fields.js # Zarządzanie tabelami
```

## 🔄 Migracja z obecnego kodu

### Zmiany w Airtable:

1. **Nowe pole `platform`** zostanie automatycznie dodane do wszystkich tabel
2. **Istniejące dane** zachowają kompatybilność
3. **Nowe rekordy** będą miały informację o platformie

### Zmiany w kodzie:

- `runTikTokScraper()` - nadal działa jak wcześniej
- `runMultiPlatformScraper()` - nowa funkcja dla wszystkich platform
- Serwer automatycznie obsługuje nowe endpointy

## 📊 Przykładowe dane

### TikTok:

```json
{
  "platform": "tiktok",
  "author": "example_user",
  "viewsCount": 150000,
  "description": "Film o #automatyzacja #AI",
  "url": "https://www.tiktok.com/@user/video/123",
  "subtitles": "Tekst napisów z filmu..."
}
```

### Instagram:

```json
{
  "platform": "instagram",
  "author": "example_user",
  "viewsCount": 5000,
  "description": "Post o #automatyzacja #AI",
  "url": "https://www.instagram.com/p/ABC123/",
  "subtitles": null
}
```

### YouTube:

```json
{
  "platform": "youtube",
  "author": "Example Channel",
  "viewsCount": 50000,
  "description": "Film o automatyzacji",
  "url": "https://www.youtube.com/watch?v=ABC123",
  "subtitles": null
}
```

## 🔍 Debugowanie

### Sprawdź logi:

```bash
# Uruchom z logami
npm run dev

# Sprawdź konkretną platformę
curl -X POST http://localhost:3000/run-tiktok
```

### Sprawdź status:

```bash
curl http://localhost:3000/ping
```

## 🛠️ Rozwiązywanie problemów

### Problem: Błąd "Nieobsługiwana platforma"

**Rozwiązanie:** Sprawdź czy nazwa platformy jest poprawna: `tiktok`, `instagram`, `youtube`

### Problem: Brak pola `platform` w Airtable

**Rozwiązanie:** Uruchom `node create-table-fields.js` lub dodaj pole ręcznie

### Problem: Instagram nie zwraca wyników

**Rozwiązanie:** Instagram może wymagać innych hashtagów - sprawdź konfigurację

### Problem: YouTube nie znajduje filmów

**Rozwiązanie:** YouTube szuka w tytułach i opisach - dostosuj hashtagi

## 🎯 Następne kroki

1. **Przetestuj każdą platformę osobno**
2. **Skonfiguruj platformy w hashtagSeries**
3. **Sprawdź czy dane są poprawnie zapisywane**
4. **Dostosuj hashtagi dla każdej platformy**

## 📞 Wsparcie

Jeśli masz pytania:

1. Sprawdź logi serwera
2. Przetestuj pojedynczą platformę
3. Sprawdź konfigurację w Airtable
4. Upewnij się że APIFY_TOKEN jest ustawiony

---

**🎉 Gratulacje! Twój scraper teraz obsługuje 3 platformy jednocześnie!**
