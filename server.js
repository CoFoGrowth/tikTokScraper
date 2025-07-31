const express = require("express");
const cron = require("node-cron");
const path = require("path");
const {
  runMultiPlatformScraper,
  runTikTokScraper,
  runInstagramScraper,
  runYouTubeScraper,
} = require("./index");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware do parsowania JSON
app.use(express.json());

// Serwowanie statycznych plików (frontend)
app.use(express.static(path.join(__dirname, "public")));

// Strona główna - serwuje frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Endpoint do monitorowania (dla serwisów uptime monitoring)
app.get("/ping", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// API endpoint dla niestandardowego scrapingu z frontendu
app.post("/api/scrape-custom", async (req, res) => {
  try {
    const { mainHashtag, firstHashtag, secondHashtag, platform, resultsCount } =
      req.body;

    // Walidacja danych wejściowych
    if (!mainHashtag || !platform || !resultsCount) {
      return res.status(400).json({
        success: false,
        message: "Wymagane pola: mainHashtag, platform, resultsCount",
      });
    }

    if (resultsCount < 5 || resultsCount > 100) {
      return res.status(400).json({
        success: false,
        message: "Liczba wyników musi być między 5 a 100",
      });
    }

    console.log(`🚀 Uruchamianie niestandardowego scrapingu:`);
    console.log(`   Główny hashtag: #${mainHashtag}`);
    console.log(
      `   Dodatkowe hashtagi: ${
        [firstHashtag, secondHashtag]
          .filter(Boolean)
          .map((h) => "#" + h)
          .join(", ") || "brak"
      }`
    );
    console.log(`   Platforma: ${platform}`);
    console.log(`   Liczba wyników: ${resultsCount}`);

    // Import platform-manager do niestandardowego scrapingu
    const PlatformManager = require("./platform-manager");
    const platformManager = new PlatformManager();

    // Przygotowanie niestandardowej konfiguracji
    const customConfig = {
      mainHashtag: mainHashtag,
      additionalHashtags: [firstHashtag, secondHashtag].filter(Boolean),
      resultsPerPage: resultsCount,
      seriesName: `custom_${Date.now()}`, // Unikalna nazwa dla tymczasowej serii
      platforms:
        platform === "all" ? ["tiktok", "instagram", "youtube"] : [platform],
    };

    let result;

    if (platform === "all") {
      // Uruchom dla wszystkich platform
      result =
        await platformManager.runScrapingForAllPlatformsWithConfig(
          customConfig
        );
    } else {
      // Uruchom dla pojedynczej platformy
      result = await platformManager.runScrapingForPlatform(
        platform,
        customConfig
      );
    }

    res.json(result);
  } catch (error) {
    console.error("Błąd podczas niestandardowego scrapingu:", error);
    res.status(500).json({
      success: false,
      message: `Błąd scrapingu: ${error.message}`,
    });
  }
});

// Endpoint do ręcznego uruchamiania scrapera wszystkich platform
app.post("/run-scraper", async (req, res) => {
  try {
    console.log("Ręczne uruchomienie scrapera wszystkich platform...");
    const result = await runMultiPlatformScraper();
    res.json(result);
  } catch (error) {
    console.error("Błąd podczas ręcznego uruchamiania scrapera:", error);
    res.status(500).json({ success: false, message: `Błąd: ${error.message}` });
  }
});

// Endpoint do ręcznego uruchamiania scrapera tylko TikTok
app.post("/run-tiktok", async (req, res) => {
  try {
    console.log("Ręczne uruchomienie scrapera TikTok...");
    const result = await runTikTokScraper();
    res.json(result);
  } catch (error) {
    console.error("Błąd podczas ręcznego uruchamiania scrapera TikTok:", error);
    res
      .status(500)
      .json({ success: false, message: `Błąd TikTok: ${error.message}` });
  }
});

// Endpoint do ręcznego uruchamiania scrapera tylko Instagram
app.post("/run-instagram", async (req, res) => {
  try {
    console.log("Ręczne uruchomienie scrapera Instagram...");
    const result = await runInstagramScraper();
    res.json(result);
  } catch (error) {
    console.error(
      "Błąd podczas ręcznego uruchamiania scrapera Instagram:",
      error
    );
    res
      .status(500)
      .json({ success: false, message: `Błąd Instagram: ${error.message}` });
  }
});

// Endpoint do ręcznego uruchamiania scrapera tylko YouTube
app.post("/run-youtube", async (req, res) => {
  try {
    console.log("Ręczne uruchomienie scrapera YouTube...");
    const result = await runYouTubeScraper();
    res.json(result);
  } catch (error) {
    console.error(
      "Błąd podczas ręcznego uruchamiania scrapera YouTube:",
      error
    );
    res
      .status(500)
      .json({ success: false, message: `Błąd YouTube: ${error.message}` });
  }
});

// Konfiguracja harmonogramu - uruchamianie codziennie o 10:00 rano czasu europejskiego (CET/CEST)
// Format cron: sekunda minuta godzina dzień_miesiąca miesiąc dzień_tygodnia
// W przypadku render.com, który używa UTC, potrzebujemy dostosować godzinę
// CET (zima) = UTC+1, więc 9:00 UTC
// CEST (lato) = UTC+2, więc 8:00 UTC
// Dla uproszczenia ustawiamy na 8:00 UTC, co będzie odpowiadać 9:00 lub 10:00 w zależności od czasu letniego/zimowego
cron.schedule(
  "0 0 8 * * *",
  async () => {
    try {
      console.log(
        "Uruchamianie zaplanowanego zadania scrapera wszystkich platform..."
      );
      await runMultiPlatformScraper();
      console.log("Zaplanowane zadanie scrapera zakończone.");
    } catch (error) {
      console.error("Błąd podczas zaplanowanego zadania scrapera:", error);
    }
  },
  {
    scheduled: true,
    timezone: "UTC",
  }
);

// Uruchomienie serwera
app.listen(PORT, () => {
  console.log(
    `🚀 Multi-Platform Hashtag Scraper Server działa na porcie ${PORT}`
  );
  console.log("📱 Obsługiwane platformy: TikTok, Instagram, YouTube");
  console.log("🌐 Frontend dostępny na: http://localhost:" + PORT);
  console.log(
    "⏰ Scraper zostanie uruchomiony codziennie o 10:00 czasu europejskiego"
  );
  console.log("\n🔗 Dostępne endpointy:");
  console.log("   GET  /                 - Frontend (landing page)");
  console.log("   POST /api/scrape-custom - Niestandardowy scraping");
  console.log("   POST /run-scraper      - Wszystkie platformy (stara wersja)");
  console.log("   POST /run-tiktok       - Tylko TikTok");
  console.log("   POST /run-instagram    - Tylko Instagram");
  console.log("   POST /run-youtube      - Tylko YouTube");
  console.log("   GET  /ping             - Status serwera");
});
