const PlatformManager = require("./platform-manager");
try {
  require("dotenv").config();
} catch (error) {
  console.log("Plik .env nie został znaleziony");
}

// Wszystkie funkcje pomocnicze zostały przeniesione do modułów scraperów i platform-manager

// Funkcja główna - używa nowego PlatformManagera
async function runMultiPlatformScraper() {
  console.log("Rozpoczynam proces pobierania danych z wszystkich platform...");

  try {
    const platformManager = new PlatformManager();
    const result = await platformManager.runScrapingForAllSeries();

    console.log("=== PODSUMOWANIE KOŃCOWE ===");
    if (result.success) {
      console.log("✅ Scraping zakończony pomyślnie!");
      console.log(`📊 Statystyki:`);
      console.log(`   - Udanych operacji: ${result.results.successful}`);
      console.log(`   - Nieudanych operacji: ${result.results.failed}`);
      console.log(`   - Łącznie elementów: ${result.results.totalItems}`);
    } else {
      console.log("❌ Scraping zakończony z błędami");
      console.log(`Szczegóły: ${result.message}`);
    }

    return result;
  } catch (error) {
    console.error("Wystąpił krytyczny błąd:", error);
    return { success: false, message: `Krytyczny błąd: ${error.message}` };
  }
}

// Funkcja do scrapingu tylko TikTok (dla zachowania kompatybilności wstecznej)
async function runTikTokScraper() {
  console.log("Rozpoczynam proces pobierania danych tylko z TikTok...");

  try {
    const platformManager = new PlatformManager();
    const result = await platformManager.runScrapingForSinglePlatform("tiktok");

    if (result.success) {
      console.log("✅ Scraping TikTok zakończony pomyślnie!");
      console.log(`📊 Pobrano ${result.itemsCount} elementów`);
      return { success: true, message: "Scraping TikTok zakończony pomyślnie" };
    } else {
      console.log("❌ Scraping TikTok zakończony z błędem");
      console.log(`Szczegóły: ${result.error}`);
      return { success: false, message: `Błąd TikTok: ${result.error}` };
    }
  } catch (error) {
    console.error("Wystąpił błąd podczas scrapingu TikTok:", error);
    return { success: false, message: `Błąd: ${error.message}` };
  }
}

// Funkcja do scrapingu tylko Instagram
async function runInstagramScraper() {
  console.log("Rozpoczynam proces pobierania danych tylko z Instagram...");

  try {
    const platformManager = new PlatformManager();
    const result =
      await platformManager.runScrapingForSinglePlatform("instagram");

    if (result.success) {
      console.log("✅ Scraping Instagram zakończony pomyślnie!");
      console.log(`📊 Pobrano ${result.itemsCount} elementów`);
      return {
        success: true,
        message: "Scraping Instagram zakończony pomyślnie",
      };
    } else {
      console.log("❌ Scraping Instagram zakończony z błędem");
      console.log(`Szczegóły: ${result.error}`);
      return { success: false, message: `Błąd Instagram: ${result.error}` };
    }
  } catch (error) {
    console.error("Wystąpił błąd podczas scrapingu Instagram:", error);
    return { success: false, message: `Błąd: ${error.message}` };
  }
}

// Funkcja do scrapingu tylko YouTube
async function runYouTubeScraper() {
  console.log("Rozpoczynam proces pobierania danych tylko z YouTube...");

  try {
    const platformManager = new PlatformManager();
    const result =
      await platformManager.runScrapingForSinglePlatform("youtube");

    if (result.success) {
      console.log("✅ Scraping YouTube zakończony pomyślnie!");
      console.log(`📊 Pobrano ${result.itemsCount} elementów`);
      return {
        success: true,
        message: "Scraping YouTube zakończony pomyślnie",
      };
    } else {
      console.log("❌ Scraping YouTube zakończony z błędem");
      console.log(`Szczegóły: ${result.error}`);
      return { success: false, message: `Błąd YouTube: ${result.error}` };
    }
  } catch (error) {
    console.error("Wystąpił błąd podczas scrapingu YouTube:", error);
    return { success: false, message: `Błąd: ${error.message}` };
  }
}

// Uruchom jako samodzielny skrypt, jeśli wywołano bezpośrednio
if (require.main === module) {
  (async () => {
    await runMultiPlatformScraper();
  })();
}

module.exports = {
  runMultiPlatformScraper,
  runTikTokScraper,
  runInstagramScraper,
  runYouTubeScraper,
};
