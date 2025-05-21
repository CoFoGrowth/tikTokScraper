const Airtable = require("airtable");

// Konfiguracja Airtable
const AIRTABLE_API_KEY =
  "patuIzeLWvjgGXGWf.5f11369f405a4930cbc312dab319e7d5f1b40376011289ebde30ed2b43c320c8";
const AIRTABLE_BASE_ID = "appIVjreDvDlqC305";

const airtableBase = new Airtable({
  apiKey: AIRTABLE_API_KEY,
}).base(AIRTABLE_BASE_ID);

// Funkcja do pobierania danych z konkretnej tabeli Airtable
async function getAirtableData(tableName) {
  try {
    console.log(`Pobieranie danych z tabeli ${tableName}...`);

    const records = await airtableBase(tableName)
      .select({
        maxRecords: 30,
        view: "Grid view",
      })
      .all();

    console.log(`Pobrano ${records.length} rekordów z tabeli ${tableName}.`);

    if (records.length === 0) {
      console.log(`Brak rekordów w tabeli ${tableName}.`);
      return;
    }

    // Wyświetlamy najważniejsze informacje o rekordach
    records.forEach((record, index) => {
      const fields = record.fields;
      console.log(`\nRekord ${index + 1}:`);
      console.log(`ID: ${record.id}`);
      console.log(`Autor: ${fields.author || "brak"}`);
      console.log(`URL: ${fields.url || "brak"}`);
      console.log(`Główny hashtag: ${fields.mainHashtag || "brak"}`);
      console.log(`Inne hashtagi: ${fields.otherHashtags || "brak"}`);
      console.log(`Seria: ${fields.seriesName || "brak"}`);
      console.log(`Wyświetlenia: ${fields.viewsCount || 0}`);

      // Sprawdzamy, czy są napisy i pokazujemy fragment
      if (fields.subtitles) {
        console.log(`Napisy: TAK (${fields.subtitles.length} znaków)`);
        console.log(
          `Fragment napisów: ${fields.subtitles.substring(0, 100)}...`
        );
      } else {
        console.log("Napisy: BRAK");
      }
    });

    return records;
  } catch (error) {
    console.error(
      `Błąd podczas pobierania danych z tabeli ${tableName}:`,
      error
    );
    return [];
  }
}

// Funkcja główna
async function main() {
  try {
    console.log("========== TESTOWANIE TABEL AIRTABLE ==========");

    // Lista tabel do sprawdzenia
    const tables = [
      "HashtagsData",
      "AutomatyzacjaBiznesu",
      "HipnozaForClient0001",
    ];

    // Sprawdzamy każdą tabelę
    for (const tableName of tables) {
      console.log("\n" + "=".repeat(50));
      console.log(`SPRAWDZANIE TABELI: ${tableName}`);
      console.log("=".repeat(50));

      await getAirtableData(tableName);
    }

    console.log("\nTest tabel zakończony pomyślnie!");
  } catch (error) {
    console.error("Wystąpił błąd podczas testowania tabel:", error);
  }
}

// Uruchomienie testu
main();
