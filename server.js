const express = require("express");
const cron = require("node-cron");
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

// Strona główna
app.get("/", (req, res) => {
  res.send(`
    <h1>Multi-Platform Hashtag Scraper Server</h1>
    <p>Serwer do scrapingu hashtagów z TikTok, Instagram i YouTube</p>
    <h2>Dostępne endpointy:</h2>
    <ul>
      <li><strong>POST /run-scraper</strong> - Uruchom scraping wszystkich platform</li>
      <li><strong>POST /run-tiktok</strong> - Uruchom scraping tylko TikTok</li>
      <li><strong>POST /run-instagram</strong> - Uruchom scraping tylko Instagram</li>
      <li><strong>POST /run-youtube</strong> - Uruchom scraping tylko YouTube</li>
      <li><strong>GET /ping</strong> - Status serwera</li>
    </ul>
    <p>Status: <span style="color: green;">Działający</span></p>
  `);
});

// Endpoint do monitorowania (dla serwisów uptime monitoring)
app.get("/ping", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
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
  console.log(
    "⏰ Scraper zostanie uruchomiony codziennie o 10:00 czasu europejskiego"
  );
  console.log("\n🔗 Dostępne endpointy:");
  console.log("   POST /run-scraper    - Wszystkie platformy");
  console.log("   POST /run-tiktok     - Tylko TikTok");
  console.log("   POST /run-instagram  - Tylko Instagram");
  console.log("   POST /run-youtube    - Tylko YouTube");
  console.log("   GET  /ping           - Status serwera");
});
