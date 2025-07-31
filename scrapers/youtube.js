const { ApifyClient } = require("apify-client");

class YouTubeScraper {
  constructor(apifyToken) {
    this.client = new ApifyClient({
      token: apifyToken,
    });
    this.platform = "youtube";
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
      `Rozpoczynam scrapowanie YouTube dla hashtagu #${config.mainHashtag}...`
    );

    // Uruchomienie aktora YouTube Scraper na Apify z wyszukiwaniem
    const run = await this.client.actor("streamers/youtube-scraper").call({
      searchKeywords: config.mainHashtag,
      maxResults: config.resultsPerPage,
      proxyConfiguration: { useApifyProxy: true },
    });

    // Pobranie wyników
    const { items } = await this.client
      .dataset(run.defaultDatasetId)
      .listItems();
    console.log(
      `Pobrano ${items.length} filmów YouTube z frazą "${config.mainHashtag}"`
    );

    // Debugowanie - sprawdzamy ile filmów zawiera każdy z hashtagów osobno
    const hashtagCounts = config.additionalHashtags.reduce((acc, tag) => {
      acc[tag] = items.filter((item) => {
        const text =
          (item.title || "") +
          " " +
          (item.text || "") +
          " " +
          (item.description || "");
        return text.toLowerCase().includes(`#${tag.toLowerCase()}`);
      }).length;
      return acc;
    }, {});
    console.log("Statystyki hashtagów YouTube w pobranych filmach:");
    console.log(hashtagCounts);

    // Filtracja wyników, aby zawierały wszystkie hashtagi
    const filteredItems = items.filter((item) => {
      const text =
        (item.title || "") +
        " " +
        (item.text || "") +
        " " +
        (item.description || "");
      return this.containsAllHashtags(text, config.additionalHashtags);
    });

    console.log(
      `Znaleziono ${filteredItems.length} filmów YouTube, które zawierają wszystkie hashtagi: #${config.mainHashtag}, ${config.additionalHashtags.map((h) => "#" + h).join(", ")}`
    );

    let finalItems = [];

    // Jeśli nie znaleziono filmów z wszystkimi hashtagami, szukamy filmów z przynajmniej jednym dodatkowym hashtagiem
    if (filteredItems.length === 0) {
      console.log(
        "Nie znaleziono filmów YouTube ze wszystkimi hashtagami. Szukam filmów z przynajmniej jednym dodatkowym hashtagiem..."
      );

      const partialMatches = items
        .filter((item) => {
          const text =
            (item.title || "") +
            " " +
            (item.text || "") +
            " " +
            (item.description || "");
          const found = this.debugHashtags(text, config.additionalHashtags);
          return found.length > 0;
        })
        .map((item) => {
          const text =
            (item.title || "") +
            " " +
            (item.text || "") +
            " " +
            (item.description || "");
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
        `Znaleziono ${partialMatches.length} filmów YouTube z przynajmniej jednym dodatkowym hashtagiem`
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

    // Dodaj metadata dla każdego filmu
    const itemsWithMetadata = finalItems.map((item) => ({
      ...item,
      input: config.mainHashtag,
      searchHashtag: {
        views: 0,
        name: config.mainHashtag,
      },
      seriesName: config.seriesName,
      platform: this.platform, // Dodajemy informację o platformie
      // YouTube może mieć napisy, ale aktualne scrapery Apify mogą ich nie pobierać automatycznie
      // W przyszłości można dodać osobny scraper napisów YouTube
    }));

    return itemsWithMetadata;
  }

  // Funkcja do formatowania danych do zapisu w Airtable
  formatDataForStorage(items) {
    return items.map((item) => {
      const fields = {
        platform: this.platform,
        author: item.channelName || "Nieznany",
        viewsCount: item.viewCount || 0,
        otherHashtags: item.foundHashtags
          ? item.foundHashtags.map((h) => "#" + h).join(", ")
          : "",
        description: item.title || "",
        url: item.url || "",
        createdAt: new Date().toISOString().split("T")[0],
        // YouTube może mieć napisy, ale dla uproszczenia na razie ich nie pobieramy
        subtitles: item.subtitles || null,
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

module.exports = YouTubeScraper;
