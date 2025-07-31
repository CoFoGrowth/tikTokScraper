const { ApifyClient } = require("apify-client");
const https = require("https");
const fs = require("fs");
const path = require("path");

class TikTokScraper {
  constructor(apifyToken) {
    this.client = new ApifyClient({
      token: apifyToken,
    });
    this.platform = "tiktok";
  }

  // Funkcja do pobierania napisów z filmu TikTok
  async downloadSubtitles(videoItem) {
    if (
      !videoItem.videoMeta?.subtitleLinks ||
      videoItem.videoMeta.subtitleLinks.length === 0
    ) {
      console.log(`Film ${videoItem.id} nie ma dostępnych napisów.`);
      return null;
    }

    console.log(`Pobieranie napisów TikTok dla filmu ${videoItem.id}...`);

    // Utwórz folder na napisy, jeśli nie istnieje
    const subtitlesDir = path.join(__dirname, "../subtitles");
    if (!fs.existsSync(subtitlesDir)) {
      fs.mkdirSync(subtitlesDir);
    }

    // Utwórz folder na napisy w formacie tekstowym, jeśli nie istnieje
    const textDir = path.join(__dirname, "../subtitles_text");
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

      console.log(`Zapisano polskie napisy TikTok do pliku ${filename}`);

      // Konwertuj na zwykły tekst i zapisz (tymczasowo)
      const plainText = this.convertSubtitlesToText(subtitleContent);
      const textFilename = `${videoItem.id}_${language}.txt`;
      const textFilePath = path.join(textDir, textFilename);
      fs.writeFileSync(textFilePath, plainText);

      console.log(
        `Zapisano polskie napisy TikTok jako tekst do pliku ${textFilename}`
      );

      // Dodaj ścieżkę do pliku z napisami do obiektu z napisami
      subtitles[language] = {
        filePath,
        textFilePath,
        content: subtitleContent,
        textContent: plainText,
      };
    } catch (error) {
      console.error(
        `Błąd podczas pobierania polskich napisów TikTok:`,
        error.message
      );
    }

    return subtitles;
  }

  // Funkcja do konwersji napisów SRT do zwykłego tekstu
  convertSubtitlesToText(subtitleContent) {
    const lines = subtitleContent.split("\n");

    let plainText = "";
    let skipNextLine = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line === "WEBVTT") continue;
      if (line === "") continue;
      if (line.includes("-->")) {
        skipNextLine = false;
        continue;
      }
      if (/^\d+$/.test(line)) continue;

      if (!skipNextLine) {
        plainText += line + " ";
      }
    }

    return this.formatPlainText(plainText.trim());
  }

  formatPlainText(text) {
    text = text.replace(/\s+/g, " ").trim();
    text = text.replace(
      /([a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ])\s+([A-ZĄĆĘŁŃÓŚŹŻ])/g,
      "$1. $2"
    );
    text = text.replace(/\.+/g, ".");
    text = text.replace(/\.([A-ZĄĆĘŁŃÓŚŹŻ])/g, ". $1");

    const sentences = text.split(". ");
    let formattedText = "";
    let sentenceCount = 0;

    for (let i = 0; i < sentences.length; i++) {
      if (sentences[i].trim() === "") continue;

      let sentence = sentences[i];
      if (!sentence.endsWith(".")) {
        sentence += ".";
      }

      formattedText += sentence + " ";
      sentenceCount++;

      if (sentenceCount >= 3 && i < sentences.length - 1) {
        formattedText += "\n\n";
        sentenceCount = 0;
      }
    }

    return formattedText.trim();
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
      `Rozpoczynam scrapowanie TikTok dla hashtagu #${config.mainHashtag}...`
    );

    // Uruchomienie aktora TikTok Scraper na Apify z dynamicznymi parametrami
    const run = await this.client.actor("clockworks/tiktok-scraper").call({
      hashtags: [config.mainHashtag],
      resultsPerPage: config.resultsPerPage,
      proxyConfiguration: { useApifyProxy: true },
    });

    // Pobranie wyników
    const { items } = await this.client
      .dataset(run.defaultDatasetId)
      .listItems();
    console.log(
      `Pobrano ${items.length} postów TikTok z hashtagiem #${config.mainHashtag}`
    );

    // Debugowanie - sprawdzamy ile filmików zawiera każdy z hashtagów osobno
    const hashtagCounts = config.additionalHashtags.reduce((acc, tag) => {
      acc[tag] = items.filter((item) =>
        (item.text || "").toLowerCase().includes(`#${tag.toLowerCase()}`)
      ).length;
      return acc;
    }, {});
    console.log("Statystyki hashtagów TikTok w pobranych filmikach:");
    console.log(hashtagCounts);

    // Filtracja wyników, aby zawierały wszystkie hashtagi
    const filteredItems = items.filter((item) =>
      this.containsAllHashtags(item.text, config.additionalHashtags)
    );

    console.log(
      `Znaleziono ${filteredItems.length} filmików TikTok, które zawierają wszystkie hashtagi: #${config.mainHashtag}, ${config.additionalHashtags.map((h) => "#" + h).join(", ")}`
    );

    let finalItems = [];

    // Jeśli nie znaleziono filmików z wszystkimi hashtagami, szukamy filmików z przynajmniej jednym dodatkowym hashtagiem
    if (filteredItems.length === 0) {
      console.log(
        "Nie znaleziono filmików TikTok ze wszystkimi hashtagami. Szukam filmików z przynajmniej jednym dodatkowym hashtagiem..."
      );

      const partialMatches = items
        .filter((item) => {
          const found = this.debugHashtags(
            item.text,
            config.additionalHashtags
          );
          return found.length > 0;
        })
        .map((item) => {
          const foundHashtags = this.debugHashtags(
            item.text,
            config.additionalHashtags
          );
          return {
            ...item,
            foundHashtags,
          };
        })
        .sort((a, b) => b.foundHashtags.length - a.foundHashtags.length);

      console.log(
        `Znaleziono ${partialMatches.length} filmików TikTok z przynajmniej jednym dodatkowym hashtagiem`
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

    console.log("Pobieram napisy TikTok dla znalezionych filmików...");

    // Pobierz napisy dla każdego filmu
    const itemsWithSubtitles = [];
    for (const item of finalItems) {
      const subtitles = await this.downloadSubtitles(item);
      itemsWithSubtitles.push({
        ...item,
        subtitles: subtitles,
        input: config.mainHashtag,
        searchHashtag: {
          views: 0, // Tę wartość można pobrać z Airtable w przyszłości
          name: config.mainHashtag,
        },
        seriesName: config.seriesName,
        platform: this.platform, // Dodajemy informację o platformie
      });
    }

    return itemsWithSubtitles;
  }

  // Funkcja do formatowania danych do zapisu w Airtable
  formatDataForStorage(items) {
    return items.map((item) => {
      const fields = {
        platform: this.platform,
        author: item.authorMeta?.name || "Nieznany",
        viewsCount: item.playCount || 0,
        otherHashtags: item.foundHashtags
          ? item.foundHashtags.map((h) => "#" + h).join(", ")
          : "",
        description: item.text || "",
        url: item.webVideoUrl || "",
        createdAt: new Date().toISOString().split("T")[0],
      };

      if (
        item.subtitles &&
        item.subtitles["pol-PL"] &&
        item.subtitles["pol-PL"].textContent
      ) {
        fields.subtitles = item.subtitles["pol-PL"].textContent;
      }

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

module.exports = TikTokScraper;
