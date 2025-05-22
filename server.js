const express = require("express");
const cron = require("node-cron");
const { runTikTokScraper } = require("./index");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware do parsowania JSON
app.use(express.json());

// Strona główna
app.get("/", (req, res) => {
  res.send("TikTok Hashtag Scraper Server - Działający");
});

// Endpoint do monitorowania (dla serwisów uptime monitoring)
app.get("/ping", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Endpoint do ręcznego uruchamiania scrapera
app.post("/run-scraper", async (req, res) => {
  try {
    console.log("Ręczne uruchomienie scrapera...");
    const result = await runTikTokScraper();
    res.json(result);
  } catch (error) {
    console.error("Błąd podczas ręcznego uruchamiania scrapera:", error);
    res.status(500).json({ success: false, message: `Błąd: ${error.message}` });
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
      console.log("Uruchamianie zaplanowanego zadania scrapera...");
      await runTikTokScraper();
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
  console.log(`Serwer działa na porcie ${PORT}`);
  console.log(
    "Scraper TikTok zostanie uruchomiony codziennie o 10:00 czasu europejskiego"
  );
});
