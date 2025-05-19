const { ApifyClient } = require("apify-client");
const fs = require("fs");
const Airtable = require("airtable");
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

// Funkcja do zapisywania danych w Airtable
async function saveToAirtable(items) {
  console.log(`Zapisuję ${items.length} filmików do Airtable...`);

  const records = items.map((item) => {
    // Przygotowanie danych zgodnie ze strukturą tabeli Airtable
    return {
      fields: {
        author: item.authorMeta?.name || "Nieznany",
        viewsCount: item.playCount || 0,
        otherHashtags: item.foundHashtags
          ? item.foundHashtags.map((h) => "#" + h).join(", ")
          : "",
        description: item.text || "",
        url: item.webVideoUrl || "",
        createdAt: new Date().toISOString().split("T")[0],
      },
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
    const additionalHashtags = ["AI", "dlabiznesu"];

    // Uruchomienie aktora TikTok Scraper na Apify
    const run = await client.actor("clockworks/tiktok-scraper").call({
      hashtags: [mainHashtag],
      resultsPerPage: 30,
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
      const finalItems = partialMatches.slice(0, 30);

      // Zapisanie danych do pliku JSON
      fs.writeFileSync(
        "tiktok_common_hashtags.json",
        JSON.stringify(finalItems, null, 2)
      );
      console.log("Dane zapisane do pliku tiktok_common_hashtags.json");

      // Zapisanie danych do Airtable
      await saveToAirtable(finalItems);

      // Wypisanie podstawowych informacji o znalezionych filmikach
      finalItems.forEach((item, index) => {
        console.log(`\nFilmik ${index + 1}:`);
        console.log(`URL: ${item.webVideoUrl}`);
        console.log(`Opis: ${item.text}`);
        console.log(`Autor: ${item.authorMeta?.name}`);
        console.log(`Liczba wyświetleń: ${item.playCount}`);
        console.log(
          `Znalezione hashtagi: ${item.foundHashtags.map((h) => "#" + h).join(", ")}`
        );
      });
    } else {
      // Limutujemy do 30 wyników
      const finalItems = filteredItems.slice(0, 30);

      // Zapisanie danych do pliku JSON
      fs.writeFileSync(
        "tiktok_common_hashtags.json",
        JSON.stringify(finalItems, null, 2)
      );
      console.log("Dane zapisane do pliku tiktok_common_hashtags.json");

      // Przygotowanie danych do zapisania w Airtable
      const itemsWithHashtags = finalItems.map((item) => ({
        ...item,
        foundHashtags: additionalHashtags,
      }));

      // Zapisanie danych do Airtable
      await saveToAirtable(itemsWithHashtags);

      // Wypisanie podstawowych informacji o znalezionych filmikach
      finalItems.forEach((item, index) => {
        console.log(`\nFilmik ${index + 1}:`);
        console.log(`URL: ${item.webVideoUrl}`);
        console.log(`Opis: ${item.text}`);
        console.log(`Autor: ${item.authorMeta?.name}`);
        console.log(`Liczba wyświetleń: ${item.playCount}`);
      });
    }
  } catch (error) {
    console.error("Wystąpił błąd:", error);
  }
})();
