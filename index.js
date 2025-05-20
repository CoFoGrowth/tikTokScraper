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

    // Zapisz napisy do pliku SRT
    const filename = `${videoItem.id}_${language}.srt`;
    const filePath = path.join(subtitlesDir, filename);
    fs.writeFileSync(filePath, subtitleContent);

    console.log(`Zapisano polskie napisy do pliku ${filename}`);

    // Konwertuj na zwykły tekst i zapisz
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
  console.log(`Zapisuję ${items.length} filmików do Airtable...`);

  const records = items.map((item) => {
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
      await airtableBase(AIRTABLE_TABLE_NAME).create(chunk);
    }
    console.log("Dane zostały pomyślnie zapisane w Airtable");
  } catch (error) {
    console.error("Błąd podczas zapisywania do Airtable:", error);
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

(async () => {
  console.log("Rozpoczynam scrapowanie hashtagów TikTok przy użyciu Apify...");
  try {
    const mainHashtag = "automatyzacja";
    const additionalHashtags = ["AI"];

    // Uruchomienie aktora TikTok Scraper na Apify
    const run = await client.actor("clockworks/tiktok-scraper").call({
      hashtags: [mainHashtag],
      resultsPerPage: 10,
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

      // Limutujemy do 30 wyników
      finalItems = partialMatches.slice(0, 10);
    } else {
      // Limutujemy do 30 wyników
      finalItems = filteredItems.slice(0, 10).map((item) => ({
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
      });
    }

    // Zapisanie danych do pliku JSON
    fs.writeFileSync(
      "tiktok_common_hashtags.json",
      JSON.stringify(finalItems, null, 2)
    );
    console.log("Dane zapisane do pliku tiktok_common_hashtags.json");

    // Zapisanie danych z napisami do osobnego pliku JSON
    fs.writeFileSync(
      "tiktok_with_subtitles.json",
      JSON.stringify(itemsWithSubtitles, null, 2)
    );
    console.log("Dane z napisami zapisane do pliku tiktok_with_subtitles.json");

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

    // Naprawiamy problem - używamy itemsWithSubtitles zamiast finalItems
    await saveToAirtable(itemsWithSubtitles);

    // Wypisanie podstawowych informacji o znalezionych filmikach
    itemsWithSubtitles.forEach((item, index) => {
      console.log(`\nFilmik ${index + 1}:`);
      console.log(`URL: ${item.webVideoUrl}`);
      console.log(`Opis: ${item.text}`);
      console.log(`Autor: ${item.authorMeta?.name}`);
      console.log(`Liczba wyświetleń: ${item.playCount}`);
      if (item.foundHashtags) {
        console.log(
          `Znalezione hashtagi: ${item.foundHashtags.map((h) => "#" + h).join(", ")}`
        );
      }
      if (item.subtitles) {
        console.log(
          `Pobrane napisy w językach: ${Object.keys(item.subtitles).join(", ")}`
        );
      } else {
        console.log("Brak napisów dla tego filmiku");
      }
    });
  } catch (error) {
    console.error("Wystąpił błąd:", error);
  }
})();
