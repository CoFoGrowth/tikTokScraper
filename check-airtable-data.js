const Airtable = require("airtable");

// Konfiguracja Airtable
const AIRTABLE_API_KEY =
  "patuIzeLWvjgGXGWf.5f11369f405a4930cbc312dab319e7d5f1b40376011289ebde30ed2b43c320c8";
const AIRTABLE_BASE_ID = "appIVjreDvDlqC305";
const AIRTABLE_TABLE_NAME = "HashtagsData";

const airtableBase = new Airtable({
  apiKey: AIRTABLE_API_KEY,
}).base(AIRTABLE_BASE_ID);

// Funkcja do pobierania danych z Airtable
async function getAirtableData() {
  try {
    console.log("Pobieranie danych z Airtable...");

    const records = await airtableBase(AIRTABLE_TABLE_NAME)
      .select({
        maxRecords: 10,
        view: "Grid view",
      })
      .all();

    console.log(`Pobrano ${records.length} rekordów z Airtable.`);

    if (records.length > 0) {
      // Wyświetl szczegóły pierwszego rekordu dla diagnostyki
      console.log("\nSzczegóły pierwszego rekordu:");
      const fields = records[0].fields;
      console.log("ID:", records[0].id);
      console.log("Autor:", fields.author);
      console.log("URL:", fields.url);
      console.log("Opis:", fields.description);
      console.log("Hashtagi:", fields.otherHashtags);
      console.log("Data utworzenia:", fields.createdAt);
      console.log("Napisy dostępne:", fields.subtitles ? "Tak" : "Nie");

      if (fields.subtitles) {
        console.log("Długość napisów:", fields.subtitles.length);
        console.log(
          "Fragment napisów:",
          fields.subtitles.substring(0, 100) + "..."
        );
      }
    } else {
      console.log("Brak rekordów w bazie Airtable!");
    }

    // Sprawdź wszystkie rekordy pod kątem pola subtitles
    console.log("\nRekordy z napisami:");
    let recordsWithSubtitles = 0;

    records.forEach((record, index) => {
      if (record.fields.subtitles) {
        recordsWithSubtitles++;
        console.log(
          `Rekord ${index + 1}: ${record.fields.author} - Napisy: ${record.fields.subtitles.length} znaków`
        );
      }
    });

    console.log(
      `\nLiczba rekordów z napisami: ${recordsWithSubtitles} z ${records.length}`
    );
  } catch (error) {
    console.error("Błąd podczas pobierania danych z Airtable:", error);
  }
}

// Wywołanie funkcji
getAirtableData();
