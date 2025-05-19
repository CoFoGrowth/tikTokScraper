const { ApifyClient } = require("apify-client");
const fs = require("fs");
require("dotenv").config();

// Inicjalizacja klienta Apify z Twoim tokenem API
const client = new ApifyClient({
  token: process.env.APIFY_TOKEN,
});

(async () => {
  try {
    console.log(
      "Rozpoczynam scrapowanie hashtagów TikTok przy użyciu Apify..."
    );

    // Uruchomienie aktora TikTok Scraper na Apify
    const run = await client.actor("clockworks/tiktok-scraper").call({
      hashtags: ["AI"],
      resultsPerPage: 10,
      proxyConfiguration: { useApifyProxy: true },
    });

    // Pobranie wyników
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log(`Pobrano ${items.length} postów z hashtagiem #AI`);

    // Zapisanie danych do pliku JSON
    fs.writeFileSync("tiktok_ai_data.json", JSON.stringify(items, null, 2));
    console.log("Dane zapisane do pliku tiktok_ai_data.json");
  } catch (error) {
    console.error("Wystąpił błąd:", error);
  }
})();
