const Airtable = require("airtable");

// Konfiguracja Airtable
const AIRTABLE_API_KEY =
  "patuIzeLWvjgGXGWf.5f11369f405a4930cbc312dab319e7d5f1b40376011289ebde30ed2b43c320c8";
const AIRTABLE_BASE_ID = "appIVjreDvDlqC305";
const TABLE_NAME = "AutomatyzacjaBiznesu";

const airtableBase = new Airtable({
  apiKey: AIRTABLE_API_KEY,
}).base(AIRTABLE_BASE_ID);

// Funkcja główna
async function main() {
  try {
    console.log(`Sprawdzanie pól w tabeli ${TABLE_NAME}...`);

    const records = await airtableBase(TABLE_NAME)
      .select({
        maxRecords: 1,
        view: "Grid view",
      })
      .all();

    if (records.length === 0) {
      console.log(`Nie znaleziono rekordów w tabeli ${TABLE_NAME}.`);
      return;
    }

    const fields = records[0].fields;
    console.log("Dostępne pola w tabeli:");
    console.log(Object.keys(fields));

    console.log("\nSzczegóły pierwszego rekordu:");
    for (const [key, value] of Object.entries(fields)) {
      console.log(`${key}: ${value}`);
    }
  } catch (error) {
    console.error(`Wystąpił błąd:`, error);
  }
}

main();
