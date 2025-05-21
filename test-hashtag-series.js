const Airtable = require("airtable");

// Konfiguracja Airtable
const AIRTABLE_API_KEY =
  "patuIzeLWvjgGXGWf.5f11369f405a4930cbc312dab319e7d5f1b40376011289ebde30ed2b43c320c8";
const AIRTABLE_BASE_ID = "appIVjreDvDlqC305";
const AIRTABLE_HASHTAG_SERIES_TABLE = "hashtagSeries";

const airtableBase = new Airtable({
  apiKey: AIRTABLE_API_KEY,
}).base(AIRTABLE_BASE_ID);

// Funkcja do pobierania danych o hashtagach z tabeli hashtagSeries w Airtable
async function getHashtagSeriesFromAirtable() {
  console.log("Pobieranie konfiguracji hashtagów z Airtable...");

  try {
    const records = await airtableBase(AIRTABLE_HASHTAG_SERIES_TABLE)
      .select({
        maxRecords: 10, // Zwiększamy limit, aby zobaczyć wszystkie rekordy
        view: "Grid view",
      })
      .all();

    console.log(`Znaleziono ${records.length} rekordów w tabeli hashtagSeries`);

    if (records.length === 0) {
      console.log("Brak rekordów w tabeli hashtagSeries.");
      return;
    }

    // Wyświetlamy wszystkie znalezione rekordy
    records.forEach((record, index) => {
      const fields = record.fields;
      console.log(`\nRekord ${index + 1}:`);
      console.log(`ID: ${record.id}`);
      console.log(`Nazwa serii: ${fields.seriesName || "nie określono"}`);
      console.log(`Główny hashtag: ${fields.mainHastags || "nie określono"}`);
      console.log(
        `Dodatkowy hashtag 1: ${fields.firstAddidionalHashtags || "nie określono"}`
      );
      console.log(
        `Dodatkowy hashtag 2: ${fields.secondAdditionalHashtags || "nie określono"}`
      );
      console.log(
        `Ilość filmików: ${fields.countVideosForMainHashtag || "nie określono"}`
      );

      // Wyświetlamy wszystkie pola
      console.log("Wszystkie pola:", Object.keys(fields));
      console.log("Wartości pól:", fields);
    });
  } catch (error) {
    console.error(
      "Błąd podczas pobierania konfiguracji hashtagów z Airtable:",
      error
    );
  }
}

// Uruchomienie testu
(async () => {
  try {
    await getHashtagSeriesFromAirtable();
    console.log("\nTest zakończony pomyślnie!");
  } catch (error) {
    console.error("Wystąpił błąd podczas testu:", error);
  }
})();
