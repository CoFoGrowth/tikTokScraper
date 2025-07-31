const TikTokScraper = require("./scrapers/tiktok");
const InstagramScraper = require("./scrapers/instagram");
const YouTubeScraper = require("./scrapers/youtube");
const Airtable = require("airtable");
const fs = require("fs");
const path = require("path");

class PlatformManager {
  constructor() {
    this.APIFY_TOKEN = process.env.APIFY_TOKEN;

    // Konfiguracja Airtable
    this.AIRTABLE_API_KEY =
      process.env.AIRTABLE_API_KEY ||
      "patuIzeLWvjgGXGWf.5f11369f405a4930cbc312dab319e7d5f1b40376011289ebde30ed2b43c320c8";
    this.AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "appIVjreDvDlqC305";
    this.AIRTABLE_TABLE_NAME = "HashtagsData";
    this.AIRTABLE_HASHTAG_SERIES_TABLE = "hashtagSeries";

    this.airtableBase = new Airtable({
      apiKey: this.AIRTABLE_API_KEY,
    }).base(this.AIRTABLE_BASE_ID);

    // Inicjalizacja scraperów
    this.scrapers = {
      tiktok: new TikTokScraper(this.APIFY_TOKEN),
      instagram: new InstagramScraper(this.APIFY_TOKEN),
      youtube: new YouTubeScraper(this.APIFY_TOKEN),
    };
  }

  // Funkcja do usuwania plików z podanego folderu
  cleanupFolder(folderPath) {
    if (fs.existsSync(folderPath)) {
      console.log(`Czyszczenie folderu ${folderPath}...`);
      const files = fs.readdirSync(folderPath);

      for (const file of files) {
        const filePath = path.join(folderPath, file);
        fs.unlinkSync(filePath);
        console.log(`Usunięto plik: ${filePath}`);
      }
    }
  }

  // Funkcja do zapisywania danych w Airtable z obsługą platform
  async saveToAirtable(items, platform) {
    // Grupujemy dane według serii
    const itemsBySeries = items.reduce((acc, item) => {
      const seriesName = item.seriesName || "default";
      if (!acc[seriesName]) {
        acc[seriesName] = [];
      }
      acc[seriesName].push(item);
      return acc;
    }, {});

    for (const [seriesName, seriesItems] of Object.entries(itemsBySeries)) {
      console.log(
        `Zapisuję ${seriesItems.length} elementów z ${platform} dla serii "${seriesName}" do Airtable...`
      );

      const tableUtils = require("./create-table-fields");
      const formattedTableName = tableUtils.formatTableName(seriesName);

      console.log(`Sprawdzanie/tworzenie tabeli: ${formattedTableName}`);
      const tableExists = await tableUtils.createTable(formattedTableName);

      let tableName = tableExists ? formattedTableName : "AutomatyzacjaBiznesu";

      console.log(`Używam tabeli: ${tableName}`);

      // Pobierz odpowiedni scraper i sformatuj dane
      const scraper = this.scrapers[platform];
      const records = scraper.formatDataForStorage(seriesItems);

      // Dzielimy rekordy na grupy po 10, bo Airtable ma limit na liczbę rekordów w jednym żądaniu
      const chunks = [];
      for (let i = 0; i < records.length; i += 10) {
        chunks.push(records.slice(i, i + 10));
      }

      try {
        for (const chunk of chunks) {
          await this.airtableBase(tableName).create(chunk);
        }
        console.log(
          `Dane z ${platform} dla serii "${seriesName}" zostały pomyślnie zapisane w tabeli ${tableName}`
        );

        if (!tableExists) {
          console.log(
            `UWAGA: Dane zostały zapisane w tabeli domyślnej "${tableName}", ponieważ tabela "${formattedTableName}" nie istnieje.`
          );
          console.log(
            `Uruchom 'node create-table-fields.js', aby utworzyć brakujące tabele.`
          );
        }
      } catch (error) {
        console.error(
          `Błąd podczas zapisywania do tabeli ${tableName}:`,
          error
        );

        if (tableName !== "AutomatyzacjaBiznesu") {
          console.log(
            `Próbuję zapisać dane w tabeli AutomatyzacjaBiznesu jako fallback...`
          );
          try {
            for (const chunk of chunks) {
              await this.airtableBase("AutomatyzacjaBiznesu").create(chunk);
            }
            console.log(
              `Dane z ${platform} dla serii "${seriesName}" zostały pomyślnie zapisane w tabeli AutomatyzacjaBiznesu (fallback)`
            );
            console.log(
              `UWAGA: Uruchom 'node create-table-fields.js', aby utworzyć tabelę ${formattedTableName}.`
            );
          } catch (fallbackError) {
            console.error(
              `Błąd podczas zapisywania do tabeli fallback:`,
              fallbackError
            );
          }
        }
      }
    }
  }

  // Funkcja do pobierania danych o hashtagach z tabeli hashtagSeries w Airtable z obsługą platform
  async getHashtagSeriesFromAirtable(seriesName) {
    console.log(
      `Pobieranie konfiguracji hashtagów dla serii "${seriesName || "domyślnej"}" z Airtable...`
    );

    try {
      const allRecords = await this.airtableBase(
        this.AIRTABLE_HASHTAG_SERIES_TABLE
      )
        .select({
          maxRecords: 10,
          view: "Grid view",
        })
        .all();

      console.log(
        `Znaleziono ${allRecords.length} rekordów w tabeli hashtagSeries`
      );

      let matchingRecord = null;

      if (seriesName) {
        const normalizedSearchName = seriesName.trim().toLowerCase();

        for (const record of allRecords) {
          const recordSeriesName = record.fields.seriesName || "";
          const normalizedRecordName = recordSeriesName.trim().toLowerCase();

          if (normalizedRecordName === normalizedSearchName) {
            matchingRecord = record;
            console.log(
              `Znaleziono dokładne dopasowanie dla serii "${recordSeriesName}"`
            );
            break;
          } else if (
            normalizedRecordName.includes(normalizedSearchName) ||
            normalizedSearchName.includes(normalizedRecordName)
          ) {
            matchingRecord = record;
            console.log(
              `Znaleziono częściowe dopasowanie dla serii "${recordSeriesName}"`
            );
            break;
          }
        }
      } else if (allRecords.length > 0) {
        matchingRecord = allRecords[0];
        console.log(
          `Nie podano nazwy serii. Używam pierwszego rekordu: "${matchingRecord.fields.seriesName || "bez nazwy"}"`
        );
      }

      if (!matchingRecord) {
        console.log(
          `Nie znaleziono konfiguracji hashtagów dla serii "${seriesName || "domyślnej"}" w Airtable. Używam wartości domyślnych.`
        );
        return {
          mainHashtag: "automatyzacja",
          additionalHashtags: ["AI"],
          resultsPerPage: 10,
          seriesName: "",
          platforms: ["tiktok"], // Domyślnie tylko TikTok dla zachowania kompatybilności
        };
      }

      const fields = matchingRecord.fields;

      console.log("Znaleziono rekord dla serii, zawartość pól:", fields);

      const mainHashtag = fields.mainHastags || "automatyzacja";

      const additionalHashtags = [];
      if (fields.firstAddidionalHashtags)
        additionalHashtags.push(fields.firstAddidionalHashtags);
      if (fields.secondAdditionalHashtags)
        additionalHashtags.push(fields.secondAdditionalHashtags);

      const resultsPerPage = fields.countVideosForMainHashtag || 10;

      const configSeriesName = fields.seriesName || "";

      // Obsługa platform - nowe pole w konfiguracji
      let platforms = ["tiktok"]; // Domyślnie TikTok dla zachowania kompatybilności
      if (fields.platforms) {
        // Może być string oddzielony przecinkami lub array
        if (typeof fields.platforms === "string") {
          platforms = fields.platforms
            .split(",")
            .map((p) => p.trim().toLowerCase());
        } else if (Array.isArray(fields.platforms)) {
          platforms = fields.platforms.map((p) => p.toLowerCase());
        }
      }

      console.log(
        `Pobrano konfigurację: seria "${configSeriesName}", główny hashtag #${mainHashtag}, dodatkowe hashtagi: ${additionalHashtags.map((h) => "#" + h).join(", ")}, liczba elementów: ${resultsPerPage}, platformy: ${platforms.join(", ")}`
      );

      return {
        mainHashtag,
        additionalHashtags,
        resultsPerPage,
        seriesName: configSeriesName,
        platforms,
      };
    } catch (error) {
      console.error(
        "Błąd podczas pobierania konfiguracji hashtagów z Airtable:",
        error
      );
      return {
        mainHashtag: "automatyzacja",
        additionalHashtags: ["AI"],
        resultsPerPage: 10,
        seriesName: "",
        platforms: ["tiktok"], // Domyślnie tylko TikTok
      };
    }
  }

  // Główna funkcja scrapingu dla konkretnej platformy
  async runScrapingForPlatform(platform, config) {
    console.log(
      `\n=== Rozpoczynam scraping dla platformy: ${platform.toUpperCase()} ===\n`
    );

    if (!this.scrapers[platform]) {
      throw new Error(`Nieobsługiwana platforma: ${platform}`);
    }

    const scraper = this.scrapers[platform];

    try {
      // Wykonaj scraping dla danej platformy
      const scrapedItems = await scraper.scrapeContent(config);

      console.log(`Pobrano ${scrapedItems.length} elementów z ${platform}`);

      // Zapisz dane do Airtable
      await this.saveToAirtable(scrapedItems, platform);

      // Wyczyść tymczasowe pliki (tylko dla TikTok, który ma napisy)
      if (platform === "tiktok") {
        const subtitlesDir = path.join(__dirname, "subtitles");
        const textDir = path.join(__dirname, "subtitles_text");
        this.cleanupFolder(subtitlesDir);
        this.cleanupFolder(textDir);
        console.log("Wyczyszczono tymczasowe pliki");
      }

      console.log(
        `\nZakończono pobieranie i zapisywanie danych z ${platform} dla serii "${config.seriesName}"`
      );

      return { success: true, itemsCount: scrapedItems.length, platform };
    } catch (error) {
      console.error(`Błąd podczas scrapingu ${platform}:`, error);
      return { success: false, error: error.message, platform };
    }
  }

  // Główna funkcja uruchamiająca scraping dla wszystkich platform
  async runScrapingForAllSeries() {
    console.log(
      "Rozpoczynam proces pobierania danych ze wszystkich platform..."
    );

    try {
      const tableUtils = require("./create-table-fields");

      console.log(
        "Sprawdzanie i przygotowywanie tabel dla wszystkich serii..."
      );
      const allSeries = await tableUtils.getAllSeries();
      console.log(`Znaleziono ${allSeries.length} serii.`);

      await tableUtils.checkAndUpdateExistingTables();

      if (allSeries.length > 0) {
        console.log(
          "Uwaga: API Airtable może nie pozwalać na automatyczne tworzenie tabel."
        );
        console.log(
          "Jeśli zobaczysz błąd 403, będziesz musiał utworzyć tabele ręcznie przez interfejs web."
        );

        for (const serie of allSeries) {
          if (serie.name) {
            try {
              console.log(`Sprawdzanie tabeli dla serii: ${serie.name}`);
              const tableExists = await tableUtils.createTable(serie.tableName);

              if (tableExists) {
                await tableUtils.addSubtitlesFieldToTable(serie.tableName);
                await tableUtils.addPlatformFieldToTable(serie.tableName);
              }
            } catch (error) {
              console.log(
                `Błąd podczas sprawdzania tabeli ${serie.tableName}. Tabela będzie utworzona ręcznie.`
              );
            }
          }
        }
      }

      // Wykonaj scraping dla każdej serii
      console.log(
        "\n=== Rozpoczynam scraping dla wszystkich serii i platform ===\n"
      );

      const results = [];

      for (const serie of allSeries) {
        if (!serie.name) {
          console.log("Pominięto serię bez nazwy.");
          continue;
        }

        console.log(
          `\n------ Rozpoczynam scraping dla serii: ${serie.name} ------\n`
        );

        // Pobierz konfigurację hashtagów z Airtable dla tej serii
        const config = await this.getHashtagSeriesFromAirtable(serie.name);

        // Wykonaj scraping dla każdej skonfigurowanej platformy
        for (const platform of config.platforms) {
          if (!this.scrapers[platform]) {
            console.log(`⚠️ Pominięto nieobsługiwaną platformę: ${platform}`);
            continue;
          }

          const result = await this.runScrapingForPlatform(platform, config);
          results.push(result);
        }
      }

      console.log(
        "\n=== Zakończono scraping dla wszystkich serii i platform ===\n"
      );

      // Podsumowanie wyników
      const successfulResults = results.filter((r) => r.success);
      const failedResults = results.filter((r) => !r.success);

      console.log(`\n📊 PODSUMOWANIE:`);
      console.log(`✅ Udanych operacji: ${successfulResults.length}`);
      console.log(`❌ Nieudanych operacji: ${failedResults.length}`);

      if (successfulResults.length > 0) {
        console.log(
          `📈 Łącznie pobrano: ${successfulResults.reduce((sum, r) => sum + r.itemsCount, 0)} elementów`
        );
      }

      if (failedResults.length > 0) {
        console.log(`\n❌ Błędy:`);
        failedResults.forEach((r) => {
          console.log(`  - ${r.platform}: ${r.error}`);
        });
      }

      return {
        success: true,
        message: "Scraping zakończony",
        results: {
          successful: successfulResults.length,
          failed: failedResults.length,
          totalItems: successfulResults.reduce(
            (sum, r) => sum + r.itemsCount,
            0
          ),
        },
      };
    } catch (error) {
      console.error("Wystąpił błąd:", error);
      return { success: false, message: `Błąd: ${error.message}` };
    }
  }

  // Funkcja do scrapingu tylko jednej platformy (do testowania)
  async runScrapingForSinglePlatform(platform, seriesName = null) {
    console.log(
      `Rozpoczynam scraping tylko dla platformy: ${platform.toUpperCase()}`
    );

    try {
      const tableUtils = require("./create-table-fields");
      await tableUtils.checkAndUpdateExistingTables();

      // Pobierz konfigurację
      const config = await this.getHashtagSeriesFromAirtable(seriesName);

      // Wymuś użycie tylko wybranej platformy
      config.platforms = [platform];

      const result = await this.runScrapingForPlatform(platform, config);

      console.log(`\n📊 Wynik dla ${platform}:`);
      if (result.success) {
        console.log(`✅ Sukces! Pobrano ${result.itemsCount} elementów`);
      } else {
        console.log(`❌ Błąd: ${result.error}`);
      }

      return result;
    } catch (error) {
      console.error(`Błąd podczas scrapingu ${platform}:`, error);
      return { success: false, error: error.message, platform };
    }
  }
}

module.exports = PlatformManager;
