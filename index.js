const { ApifyClient } = require("apify-client");
const fs = require("fs");
const Airtable = require("airtable");
const https = require("https");
const path = require("path");
const tableUtils = require("./create-table-fields");
try {
  require("dotenv").config();
} catch (error) {
  console.log("Plik .env nie został znaleziony");
}

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const client = new ApifyClient({
  token: APIFY_TOKEN,
});

// Konfiguracja Airtable
const AIRTABLE_API_KEY =
  process.env.AIRTABLE_API_KEY ||
  "patuIzeLWvjgGXGWf.5f11369f405a4930cbc312dab319e7d5f1b40376011289ebde30ed2b43c320c8";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "appIVjreDvDlqC305";
const AIRTABLE_TABLE_NAME = "HashtagsData";
const AIRTABLE_HASHTAG_SERIES_TABLE = "hashtagSeries";

const airtableBase = new Airtable({
  apiKey: AIRTABLE_API_KEY,
}).base(AIRTABLE_BASE_ID);

// Funkcja do konwersji napisów SRT do zwykłego tekstu
function convertSubtitlesToText(subtitleContent) {
  const lines = subtitleContent.split("\n");

  let plainText = "";
  let skipNextLine = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === "WEBVTT") continue;

    if (line === "") continue;

    if (line.includes("-->")) {
      skipNextLine = false;
      continue;
    }

    if (/^\d+$/.test(line)) continue;

    if (!skipNextLine) {
      plainText += line + " ";
    }
  }

  return formatPlainText(plainText.trim());
}

function formatPlainText(text) {
  text = text.replace(/\s+/g, " ").trim();

  text = text.replace(
    /([a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ])\s+([A-ZĄĆĘŁŃÓŚŹŻ])/g,
    "$1. $2"
  );

  text = text.replace(/\.+/g, ".");

  text = text.replace(/\.([A-ZĄĆĘŁŃÓŚŹŻ])/g, ". $1");

  const sentences = text.split(". ");
  let formattedText = "";
  let sentenceCount = 0;

  for (let i = 0; i < sentences.length; i++) {
    if (sentences[i].trim() === "") continue;

    let sentence = sentences[i];
    if (!sentence.endsWith(".")) {
      sentence += ".";
    }

    formattedText += sentence + " ";
    sentenceCount++;

    if (sentenceCount >= 3 && i < sentences.length - 1) {
      formattedText += "\n\n";
      sentenceCount = 0;
    }
  }

  return formattedText.trim();
}

// Funkcja do usuwania plików z podanego folderu
function cleanupFolder(folderPath) {
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

// Funkcja do pobierania napisów z filmu TikTok
async function downloadSubtitles(videoItem) {
  if (
    !videoItem.videoMeta?.subtitleLinks ||
    videoItem.videoMeta.subtitleLinks.length === 0
  ) {
    console.log(`Film ${videoItem.id} nie ma dostępnych napisów.`);
    return null;
  }

  console.log(`Pobieranie napisów dla filmu ${videoItem.id}...`);

  // Utwórz folder na napisy, jeśli nie istnieje
  const subtitlesDir = path.join(__dirname, "subtitles");
  if (!fs.existsSync(subtitlesDir)) {
    fs.mkdirSync(subtitlesDir);
  }

  // Utwórz folder na napisy w formacie tekstowym, jeśli nie istnieje
  const textDir = path.join(__dirname, "subtitles_text");
  if (!fs.existsSync(textDir)) {
    fs.mkdirSync(textDir);
  }

  // Pobierz tylko polskie napisy
  const subtitles = {};
  const polishSubtitle = videoItem.videoMeta.subtitleLinks.find(
    (subtitle) => subtitle.language === "pol-PL"
  );

  if (!polishSubtitle) {
    console.log(`Film ${videoItem.id} nie ma polskich napisów.`);
    return null;
  }

  const language = polishSubtitle.language;
  const downloadLink = polishSubtitle.downloadLink;

  // Pobierz dane i zapisz je
  try {
    const subtitleContent = await new Promise((resolve, reject) => {
      https
        .get(downloadLink, (res) => {
          let data = "";

          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            resolve(data);
          });

          res.on("error", (err) => {
            reject(err);
          });
        })
        .on("error", (err) => {
          reject(err);
        });
    });

    // Zapisz napisy do pliku SRT (tymczasowo)
    const filename = `${videoItem.id}_${language}.srt`;
    const filePath = path.join(subtitlesDir, filename);
    fs.writeFileSync(filePath, subtitleContent);

    console.log(`Zapisano polskie napisy do pliku ${filename}`);

    // Konwertuj na zwykły tekst i zapisz (tymczasowo)
    const plainText = convertSubtitlesToText(subtitleContent);
    const textFilename = `${videoItem.id}_${language}.txt`;
    const textFilePath = path.join(textDir, textFilename);
    fs.writeFileSync(textFilePath, plainText);

    console.log(`Zapisano polskie napisy jako tekst do pliku ${textFilename}`);

    // Dodaj ścieżkę do pliku z napisami do obiektu z napisami
    subtitles[language] = {
      filePath,
      textFilePath,
      content: subtitleContent,
      textContent: plainText,
    };
  } catch (error) {
    console.error(`Błąd podczas pobierania polskich napisów:`, error.message);
  }

  return subtitles;
}

// Funkcja do zapisywania danych w Airtable
async function saveToAirtable(items) {
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
      `Zapisuję ${seriesItems.length} filmików dla serii "${seriesName}" do Airtable...`
    );

    const formattedTableName = tableUtils.formatTableName(seriesName);

    console.log(`Sprawdzanie/tworzenie tabeli: ${formattedTableName}`);
    const tableExists = await tableUtils.createTable(formattedTableName);

    let tableName = tableExists ? formattedTableName : "AutomatyzacjaBiznesu";

    console.log(`Używam tabeli: ${tableName}`);

    const records = seriesItems.map((item) => {
      const fields = {
        author: item.authorMeta?.name || "Nieznany",
        viewsCount: item.playCount || 0,
        otherHashtags: item.foundHashtags
          ? item.foundHashtags.map((h) => "#" + h).join(", ")
          : "",
        description: item.text || "",
        url: item.webVideoUrl || "",
        createdAt: new Date().toISOString().split("T")[0],
      };

      if (
        item.subtitles &&
        item.subtitles["pol-PL"] &&
        item.subtitles["pol-PL"].textContent
      ) {
        fields.subtitles = item.subtitles["pol-PL"].textContent;
      }

      if (item.seriesName || item.input) {
        const seriesInfo = `[Seria: ${item.seriesName || "brak"}, Główny hashtag: #${item.input || "brak"}]`;
        fields.otherHashtags = fields.otherHashtags
          ? `${seriesInfo} ${fields.otherHashtags}`
          : seriesInfo;
      }

      return {
        fields,
      };
    });

    // Dzielimy rekordy na grupy po 10, bo Airtable ma limit na liczbę rekordów w jednym żądaniu
    const chunks = [];
    for (let i = 0; i < records.length; i += 10) {
      chunks.push(records.slice(i, i + 10));
    }

    try {
      for (const chunk of chunks) {
        await airtableBase(tableName).create(chunk);
      }
      console.log(
        `Dane dla serii "${seriesName}" zostały pomyślnie zapisane w tabeli ${tableName}`
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
      console.error(`Błąd podczas zapisywania do tabeli ${tableName}:`, error);

      if (tableName !== "AutomatyzacjaBiznesu") {
        console.log(
          `Próbuję zapisać dane w tabeli AutomatyzacjaBiznesu jako fallback...`
        );
        try {
          for (const chunk of chunks) {
            await airtableBase("AutomatyzacjaBiznesu").create(chunk);
          }
          console.log(
            `Dane dla serii "${seriesName}" zostały pomyślnie zapisane w tabeli AutomatyzacjaBiznesu (fallback)`
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

// Funkcja do sprawdzania, czy tekst zawiera wszystkie hashtagi z listy
function containsAllHashtags(text, hashtags) {
  if (!text) return false;

  const lowerText = text.toLowerCase();
  const result = hashtags.every((tag) =>
    lowerText.includes(`#${tag.toLowerCase()}`)
  );

  return result;
}

// Funkcja do debugowania - sprawdza, które hashtagi zawiera tekst
function debugHashtags(text, hashtags) {
  if (!text) return [];

  const lowerText = text.toLowerCase();
  return hashtags.filter((tag) => lowerText.includes(`#${tag.toLowerCase()}`));
}

// Funkcja do pobierania danych o hashtagach z tabeli hashtagSeries w Airtable
async function getHashtagSeriesFromAirtable(seriesName) {
  console.log(
    `Pobieranie konfiguracji hashtagów dla serii "${seriesName || "domyślnej"}" z Airtable...`
  );

  try {
    const allRecords = await airtableBase(AIRTABLE_HASHTAG_SERIES_TABLE)
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

    console.log(
      `Pobrano konfigurację: seria "${configSeriesName}", główny hashtag #${mainHashtag}, dodatkowe hashtagi: ${additionalHashtags.map((h) => "#" + h).join(", ")}, liczba filmików: ${resultsPerPage}`
    );

    return {
      mainHashtag,
      additionalHashtags,
      resultsPerPage,
      seriesName: configSeriesName,
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
    };
  }
}

// Funkcja główna - wydzielona jako oddzielna funkcja, którą można wyeksportować
async function runTikTokScraper() {
  console.log("Rozpoczynam proces pobierania danych z TikTok...");

  try {
    console.log("Sprawdzanie i przygotowywanie tabel dla wszystkich serii...");
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
    console.log("\n=== Rozpoczynam scraping dla wszystkich serii ===\n");

    for (const serie of allSeries) {
      if (!serie.name) {
        console.log("Pominięto serię bez nazwy.");
        continue;
      }

      console.log(
        `\n------ Rozpoczynam scraping dla serii: ${serie.name} ------\n`
      );

      // Pobierz konfigurację hashtagów z Airtable dla tej serii
      const {
        mainHashtag,
        additionalHashtags,
        resultsPerPage,
        seriesName: configSeriesName,
      } = await getHashtagSeriesFromAirtable(serie.name);

      console.log(
        `Rozpoczynam scrapowanie hashtagów TikTok przy użyciu Apify dla hashtagu #${mainHashtag}...`
      );

      // Uruchomienie aktora TikTok Scraper na Apify z dynamicznymi parametrami
      const run = await client.actor("clockworks/tiktok-scraper").call({
        hashtags: [mainHashtag],
        resultsPerPage: resultsPerPage,
        proxyConfiguration: { useApifyProxy: true },
      });

      // Pobranie wyników
      const { items } = await client.dataset(run.defaultDatasetId).listItems();
      console.log(
        `Pobrano ${items.length} postów z hashtagiem #${mainHashtag}`
      );

      // Debugowanie - sprawdzamy ile filmików zawiera każdy z hashtagów osobno
      const hashtagCounts = additionalHashtags.reduce((acc, tag) => {
        acc[tag] = items.filter((item) =>
          (item.text || "").toLowerCase().includes(`#${tag.toLowerCase()}`)
        ).length;
        return acc;
      }, {});
      console.log("Statystyki hashtagów w pobranych filmikach:");
      console.log(hashtagCounts);

      // Filtracja wyników, aby zawierały wszystkie hashtagi
      const filteredItems = items.filter((item) =>
        containsAllHashtags(item.text, additionalHashtags)
      );

      console.log(
        `Znaleziono ${filteredItems.length} filmików, które zawierają wszystkie hashtagi: #${mainHashtag}, ${additionalHashtags.map((h) => "#" + h).join(", ")}`
      );

      let finalItems = [];

      // Jeśli nie znaleziono filmików z wszystkimi hashtagami, szukamy filmików z przynajmniej jednym dodatkowym hashtagiem
      if (filteredItems.length === 0) {
        console.log(
          "Nie znaleziono filmików ze wszystkimi hashtagami. Szukam filmików z przynajmniej jednym dodatkowym hashtagiem..."
        );

        const partialMatches = items
          .filter((item) => {
            const found = debugHashtags(item.text, additionalHashtags);
            return found.length > 0;
          })
          .map((item) => {
            const foundHashtags = debugHashtags(item.text, additionalHashtags);
            return {
              ...item,
              foundHashtags,
            };
          })
          .sort((a, b) => b.foundHashtags.length - a.foundHashtags.length);

        console.log(
          `Znaleziono ${partialMatches.length} filmików z przynajmniej jednym dodatkowym hashtagiem`
        );

        // Limutujemy wyniki zgodnie z konfiguracją
        finalItems = partialMatches.slice(0, resultsPerPage);
      } else {
        // Limutujemy wyniki zgodnie z konfiguracją
        finalItems = filteredItems.slice(0, resultsPerPage).map((item) => ({
          ...item,
          foundHashtags: additionalHashtags,
        }));
      }

      console.log("Pobieram napisy dla znalezionych filmików...");

      // Pobierz napisy dla każdego filmu
      const itemsWithSubtitles = [];
      for (const item of finalItems) {
        const subtitles = await downloadSubtitles(item);
        itemsWithSubtitles.push({
          ...item,
          subtitles: subtitles,
          input: mainHashtag,
          searchHashtag: {
            views: 0, // Tę wartość można pobrać z Airtable w przyszłości
            name: mainHashtag,
          },
          seriesName: configSeriesName, // Dodajemy nazwę serii do każdego rekordu
        });
      }

      // Usunięcie zapisywania danych JSON lokalnie - nie są już potrzebne
      console.log("Pomijam zapisywanie danych lokalnie w formacie JSON");

      // Sprawdźmy, czy mamy napisy w itemsWithSubtitles
      console.log("\nDebugowanie przed zapisem do Airtable:");
      console.log(`itemsWithSubtitles.length: ${itemsWithSubtitles.length}`);
      const itemsWithPolishSubtitles = itemsWithSubtitles.filter(
        (item) =>
          item.subtitles &&
          item.subtitles["pol-PL"] &&
          item.subtitles["pol-PL"].textContent
      );
      console.log(
        `Liczba filmików z polskimi napisami: ${itemsWithPolishSubtitles.length}`
      );

      if (itemsWithPolishSubtitles.length > 0) {
        const sampleItem = itemsWithPolishSubtitles[0];
        console.log(`Przykładowy fragment napisów dla ${sampleItem.id}:`);
        console.log(
          sampleItem.subtitles["pol-PL"].textContent.substring(0, 100) + "..."
        );
      }

      // Zapisujemy dane do Airtable
      await saveToAirtable(itemsWithSubtitles);

      // Po zapisaniu do Airtable, czyścimy tymczasowe pliki
      const subtitlesDir = path.join(__dirname, "subtitles");
      const textDir = path.join(__dirname, "subtitles_text");
      cleanupFolder(subtitlesDir);
      cleanupFolder(textDir);
      console.log("Wyczyszczono tymczasowe pliki");

      console.log(
        `\nZakończono pobieranie i zapisywanie danych dla serii "${configSeriesName}"`
      );
    } // koniec pętli po seriach

    console.log("\n=== Zakończono scraping dla wszystkich serii ===\n");
    return { success: true, message: "Scraping zakończony pomyślnie" };
  } catch (error) {
    console.error("Wystąpił błąd:", error);
    return { success: false, message: `Błąd: ${error.message}` };
  }
}

// Uruchom jako samodzielny skrypt, jeśli wywołano bezpośrednio
if (require.main === module) {
  (async () => {
    await runTikTokScraper();
  })();
}

module.exports = { runTikTokScraper };
