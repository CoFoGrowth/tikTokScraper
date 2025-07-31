const { ApifyClient } = require("apify-client");

class InstagramScraper {
  constructor(apifyToken) {
    this.client = new ApifyClient({
      token: apifyToken,
    });
    this.platform = "instagram";
  }

  // Funkcja do sprawdzania, czy tekst zawiera wszystkie hashtagi z listy
  containsAllHashtags(text, hashtags) {
    if (!text) return false;

    const lowerText = text.toLowerCase();
    const result = hashtags.every((tag) =>
      lowerText.includes(`#${tag.toLowerCase()}`)
    );

    return result;
  }

  // Funkcja do debugowania - sprawdza, które hashtagi zawiera tekst
  debugHashtags(text, hashtags) {
    if (!text) return [];

    const lowerText = text.toLowerCase();
    return hashtags.filter((tag) =>
      lowerText.includes(`#${tag.toLowerCase()}`)
    );
  }

  async scrapeContent(config) {
    console.log(
      `Rozpoczynam scrapowanie Instagram dla hashtagu #${config.mainHashtag}...`
    );

    // Uruchomienie aktora Instagram Hashtag Scraper na Apify z dynamicznymi parametrami
    const run = await this.client
      .actor("apify/instagram-hashtag-scraper")
      .call({
        hashtags: [config.mainHashtag],
        resultsLimit: config.resultsPerPage,
        addParentData: false,
        proxyConfiguration: { useApifyProxy: true },
      });

    // Pobranie wyników
    const { items } = await this.client
      .dataset(run.defaultDatasetId)
      .listItems();
    console.log(
      `Pobrano ${items.length} postów Instagram z hashtagiem #${config.mainHashtag}`
    );

    // Debugowanie - sprawdzamy ile postów zawiera każdy z hashtagów osobno
    const hashtagCounts = config.additionalHashtags.reduce((acc, tag) => {
      acc[tag] = items.filter((item) => {
        const text = item.caption || item.text || "";
        return text.toLowerCase().includes(`#${tag.toLowerCase()}`);
      }).length;
      return acc;
    }, {});
    console.log("Statystyki hashtagów Instagram w pobranych postach:");
    console.log(hashtagCounts);

    // Filtracja wyników, aby zawierały wszystkie hashtagi
    const filteredItems = items.filter((item) => {
      const text = item.caption || item.text || "";
      return this.containsAllHashtags(text, config.additionalHashtags);
    });

    console.log(
      `Znaleziono ${filteredItems.length} postów Instagram, które zawierają wszystkie hashtagi: #${config.mainHashtag}, ${config.additionalHashtags.map((h) => "#" + h).join(", ")}`
    );

    let finalItems = [];

    // Jeśli nie znaleziono postów z wszystkimi hashtagami, szukamy postów z przynajmniej jednym dodatkowym hashtagiem
    if (filteredItems.length === 0) {
      console.log(
        "Nie znaleziono postów Instagram ze wszystkimi hashtagami. Szukam postów z przynajmniej jednym dodatkowym hashtagiem..."
      );

      const partialMatches = items
        .filter((item) => {
          const text = item.caption || item.text || "";
          const found = this.debugHashtags(text, config.additionalHashtags);
          return found.length > 0;
        })
        .map((item) => {
          const text = item.caption || item.text || "";
          const foundHashtags = this.debugHashtags(
            text,
            config.additionalHashtags
          );
          return {
            ...item,
            foundHashtags,
          };
        })
        .sort((a, b) => b.foundHashtags.length - a.foundHashtags.length);

      console.log(
        `Znaleziono ${partialMatches.length} postów Instagram z przynajmniej jednym dodatkowym hashtagiem`
      );

      // Limutujemy wyniki zgodnie z konfiguracją
      finalItems = partialMatches.slice(0, config.resultsPerPage);
    } else {
      // Limutujemy wyniki zgodnie z konfiguracją
      finalItems = filteredItems
        .slice(0, config.resultsPerPage)
        .map((item) => ({
          ...item,
          foundHashtags: config.additionalHashtags,
        }));
    }

    // Dodaj metadata dla każdego posta
    const itemsWithMetadata = finalItems.map((item) => ({
      ...item,
      input: config.mainHashtag,
      searchHashtag: {
        views: 0, // Instagram nie udostępnia publicznie tej informacji dla hashtagów
        name: config.mainHashtag,
      },
      seriesName: config.seriesName,
      platform: this.platform, // Dodajemy informację o platformie
      // Instagram nie ma napisów jak TikTok, więc nie dodajemy pola subtitles
    }));

    return itemsWithMetadata;
  }

  // Funkcja do formatowania danych do zapisu w Airtable
  formatDataForStorage(items) {
    return items.map((item) => {
      const fields = {
        platform: this.platform,
        author: item.ownerUsername || item.username || "Nieznany",
        viewsCount: item.likesCount || 0, // Instagram używa likes zamiast views
        otherHashtags: item.foundHashtags
          ? item.foundHashtags.map((h) => "#" + h).join(", ")
          : "",
        description: item.caption || item.text || "",
        url: item.url || `https://www.instagram.com/p/${item.shortCode}/` || "",
        createdAt: new Date().toISOString().split("T")[0],
        // Instagram nie ma napisów automatycznych
        subtitles: null,
      };

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
  }
}

module.exports = InstagramScraper;
