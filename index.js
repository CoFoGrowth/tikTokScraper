const { ApifyClient } = require("apify-client");
const fs = require("fs");
const Airtable = require("airtable");
const https = require("https");
const path = require("path");
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
  "patuIzeLWvjgGXGWf.5f11369f405a4930cbc312dab319e7d5f1b40376011289ebde30ed2b43c320c8";
const AIRTABLE_BASE_ID = "appIVjreDvDlqC305";
const AIRTABLE_TABLE_NAME = "HashtagsData";
const AIRTABLE_HASHTAG_SERIES_TABLE = "hashtagSeries";

const airtableBase = new Airtable({
  apiKey: AIRTABLE_API_KEY,
}).base(AIRTABLE_BASE_ID);

// Funkcja do konwersji napisów SRT do zwykłego tekstu
function convertSubtitlesToText(subtitleContent) {
  // Dzieli zawartość na linie
  const lines = subtitleContent.split("\n");

  // Usuwa nagłówek WEBVTT i puste linie
  let plainText = "";
  let skipNextLine = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Pomija nagłówek WEBVTT
    if (line === "WEBVTT") continue;

    // Pomija puste linie
    if (line === "") continue;

    // Pomija linie z czasami (zawierające "-->")
    if (line.includes("-->")) {
      skipNextLine = false;
      continue;
    }

    // Pomija numerację
    if (/^\d+$/.test(line)) continue;

    // Dodaje linię tekstu do wyniku
    if (!skipNextLine) {
      plainText += line + " ";
    }
  }

  // Podstawowe formatowanie tekstu
  return formatPlainText(plainText.trim());
}

// Funkcja formatująca tekst dla lepszej czytelności
function formatPlainText(text) {
  // Usuń niepotrzebne spacje
  text = text.replace(/\s+/g, " ").trim();

  // Dodaj kropki na końcu zdań, jeśli ich nie ma
  text = text.replace(
    /([a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ])\s+([A-ZĄĆĘŁŃÓŚŹŻ])/g,
    "$1. $2"
  );

  // Zamień więcej niż jedną kropkę na jedną
  text = text.replace(/\.+/g, ".");

  // Dodaj spację po kropce, jeśli jej nie ma
  text = text.replace(/\.([A-ZĄĆĘŁŃÓŚŹŻ])/g, ". $1");

  // Podziel tekst na akapity co ok. 3-4 zdania
  const sentences = text.split(". ");
  let formattedText = "";
  let sentenceCount = 0;

  for (let i = 0; i < sentences.length; i++) {
    if (sentences[i].trim() === "") continue;

    // Dodaj kropkę na końcu zdania, jeśli nie ma
    let sentence = sentences[i];
    if (!sentence.endsWith(".")) {
      sentence += ".";
    }

    formattedText += sentence + " ";
    sentenceCount++;

    // Po 3-4 zdaniach utwórz nowy akapit
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
  // Sprawdzenie czy film ma napisy
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

  // Zapisujemy dane do odpowiednich tabel na podstawie nazwy serii
  for (const [seriesName, seriesItems] of Object.entries(itemsBySeries)) {
    console.log(
      `Zapisuję ${seriesItems.length} filmików dla serii "${seriesName}" do Airtable...`
    );

    // Normalizujemy nazwę serii (usuwamy białe znaki na początku i końcu, zamieniamy na małe litery)
    const normalizedSeriesName = seriesName.trim().toLowerCase();

    // Określamy nazwę tabeli na podstawie nazwy serii
    let tableName = "";
    if (normalizedSeriesName.includes("automatyzacjabiznesu")) {
      tableName = "AutomatyzacjaBiznesu";
    } else if (normalizedSeriesName.includes("hipnozaforclient0001")) {
      tableName = "HipnozaForClient0001";
    } else {
      // Jeśli nie znaleziono dopasowania, używamy domyślnej tabeli
      tableName = "AutomatyzacjaBiznesu";
    }

    console.log(`Używam tabeli: ${tableName}`);

    const records = seriesItems.map((item) => {
      // Przygotowanie danych zgodnie ze strukturą tabeli Airtable
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

      // Dodaj sformatowane napisy do pola subtitles, jeśli istnieją
      if (
        item.subtitles &&
        item.subtitles["pol-PL"] &&
        item.subtitles["pol-PL"].textContent
      ) {
        fields.subtitles = item.subtitles["pol-PL"].textContent;
      }

      // Dodajemy informację o serii i głównym hashtagu do pola otherHashtags
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
    } catch (error) {
      console.error(`Błąd podczas zapisywania do tabeli ${tableName}:`, error);

      // Jeśli wystąpił błąd, spróbujmy zapisać dane w tabeli AutomatyzacjaBiznesu jako fallback
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
            `UWAGA: Aby zapisywać dane w tabeli ${tableName}, uruchom skrypt create-table-fields.js i postępuj zgodnie z instrukcjami.`
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
    // Pobierz wszystkie rekordy z tabeli hashtagSeries
    const allRecords = await airtableBase(AIRTABLE_HASHTAG_SERIES_TABLE)
      .select({
        maxRecords: 10,
        view: "Grid view",
      })
      .all();

    console.log(
      `Znaleziono ${allRecords.length} rekordów w tabeli hashtagSeries`
    );

    // Jeśli podano nazwę serii, szukaj pasującego rekordu
    let matchingRecord = null;

    if (seriesName) {
      // Normalizujemy nazwę serii (usuwamy białe znaki na początku i końcu, zamieniamy na małe litery)
      const normalizedSearchName = seriesName.trim().toLowerCase();

      // Szukamy pasującego rekordu - najpierw dokładne dopasowanie, potem częściowe
      for (const record of allRecords) {
        const recordSeriesName = record.fields.seriesName || "";
        const normalizedRecordName = recordSeriesName.trim().toLowerCase();

        if (normalizedRecordName === normalizedSearchName) {
          // Dokładne dopasowanie po normalizacji
          matchingRecord = record;
          console.log(
            `Znaleziono dokładne dopasowanie dla serii "${recordSeriesName}"`
          );
          break;
        } else if (
          normalizedRecordName.includes(normalizedSearchName) ||
          normalizedSearchName.includes(normalizedRecordName)
        ) {
          // Częściowe dopasowanie
          matchingRecord = record;
          console.log(
            `Znaleziono częściowe dopasowanie dla serii "${recordSeriesName}"`
          );
          break;
        }
      }
    } else if (allRecords.length > 0) {
      // Jeśli nie podano nazwy serii, użyj pierwszego rekordu
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

    // Wyświetlamy informacje debugujące
    console.log("Znaleziono rekord dla serii, zawartość pól:", fields);

    // Używamy poprawnych nazw pól zgodnie z tabelą
    const mainHashtag = fields.mainHastags || "automatyzacja";

    // Pobieramy dodatkowe hashtagi z odpowiednich kolumn
    const additionalHashtags = [];
    if (fields.firstAddidionalHashtags)
      additionalHashtags.push(fields.firstAddidionalHashtags);
    if (fields.secondAdditionalHashtags)
      additionalHashtags.push(fields.secondAdditionalHashtags);

    // Pobieramy ilość filmików do pobrania
    const resultsPerPage = fields.countVideosForMainHashtag || 10;

    // Pobieramy nazwę serii (opcjonalnie)
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
    // Zwracamy wartości domyślne w przypadku błędu
    return {
      mainHashtag: "automatyzacja",
      additionalHashtags: ["AI"],
      resultsPerPage: 10,
      seriesName: "",
    };
  }
}

// Funkcja główna
(async () => {
  console.log("Rozpoczynam proces pobierania danych z TikTok...");

  try {
    // Sprawdzamy, czy podano nazwę serii jako argument wiersza poleceń
    const args = process.argv.slice(2);
    let seriesName = "";

    if (args.length > 0) {
      seriesName = args[0];
      console.log(`Wybrano serię: ${seriesName}`);
    } else {
      console.log(
        "Nie podano nazwy serii. Zostanie użyta pierwsza dostępna seria lub wartości domyślne."
      );
    }

    // Pobierz konfigurację hashtagów z Airtable
    const {
      mainHashtag,
      additionalHashtags,
      resultsPerPage,
      seriesName: configSeriesName,
    } = await getHashtagSeriesFromAirtable(seriesName);

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
    console.log(`Pobrano ${items.length} postów z hashtagiem #${mainHashtag}`);

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
  } catch (error) {
    console.error("Wystąpił błąd:", error);
  }
})();
