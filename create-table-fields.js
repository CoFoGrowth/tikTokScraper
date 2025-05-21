const Airtable = require("airtable");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
try {
  require("dotenv").config();
} catch (error) {
  console.log("Plik .env nie został znaleziony");
}

// Konfiguracja Airtable
const AIRTABLE_API_KEY =
  process.env.AIRTABLE_API_KEY ||
  "patuIzeLWvjgGXGWf.5f11369f405a4930cbc312dab319e7d5f1b40376011289ebde30ed2b43c320c8";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "appIVjreDvDlqC305";
const AIRTABLE_HASHTAG_SERIES_TABLE = "hashtagSeries";

const airtableBase = new Airtable({
  apiKey: AIRTABLE_API_KEY,
}).base(AIRTABLE_BASE_ID);

// Funkcja do rzeczywistego tworzenia tabeli za pomocą REST API Airtable
async function createTableViaRestApi(
  tableName,
  sourceTable = "AutomatyzacjaBiznesu"
) {
  try {
    console.log(`Próbuję utworzyć tabelę ${tableName} za pomocą REST API...`);

    // Upewnij się, że nazwa tabeli jest odpowiednio sformatowana
    const formattedTableName = formatTableName(tableName);

    // Pobierz strukturę tabeli źródłowej
    const sourceFields = await getTableFields(sourceTable);

    if (sourceFields.length === 0) {
      throw new Error(`Brak pól w tabeli źródłowej ${sourceTable}.`);
    }

    // Utwórz strukturę pól dla nowej tabeli
    const fields = sourceFields.map((fieldName) => {
      // Określanie typu pola na podstawie nazwy
      let type = "singleLineText"; // domyślny typ
      let fieldDef = { name: fieldName, type: type };

      if (fieldName === "viewsCount") {
        fieldDef.type = "number";
        fieldDef.options = {
          precision: 0, // liczba całkowita
        };
      } else if (fieldName === "description" || fieldName === "subtitles") {
        fieldDef.type = "multilineText";
      } else if (fieldName === "url") {
        fieldDef.type = "url";
      } else if (fieldName === "createdAt") {
        fieldDef.type = "date";
        fieldDef.options = {
          dateFormat: {
            name: "iso",
          },
        };
      }

      // Zwracamy obiekt definicji pola z odpowiednimi opcjami
      return fieldDef;
    });

    // Przygotuj dane do żądania
    const data = {
      name: formattedTableName,
      fields: fields,
    };

    // Wywołaj REST API Airtable
    console.log(
      `Wysyłam żądanie do API Airtable do endpointu: https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`
    );
    console.log("Dane żądania:", JSON.stringify(data, null, 2));

    const response = await axios({
      method: "post",
      url: `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`,
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      data: data,
    });

    console.log("Odpowiedź API:", response.status, response.statusText);

    if (response.status === 200 || response.status === 201) {
      console.log(`Tabela ${formattedTableName} została pomyślnie utworzona!`);
      console.log(
        "Szczegóły odpowiedzi:",
        JSON.stringify(response.data, null, 2)
      );
      return true;
    } else {
      console.error(
        `Otrzymano nieprawidłowy kod odpowiedzi: ${response.status}`
      );
      console.error(
        "Treść odpowiedzi:",
        JSON.stringify(response.data, null, 2)
      );
      return false;
    }
  } catch (error) {
    console.error(
      `Błąd podczas tworzenia tabeli przez REST API:`,
      error.response ? error.response.data : error.message
    );
    return false;
  }
}

// Funkcja do tworzenia tabeli (wykorzystuje REST API Airtable)
async function createTable(tableName, sourceTable = "AutomatyzacjaBiznesu") {
  try {
    console.log(`Pobieranie struktury tabeli źródłowej (${sourceTable})...`);
    const sourceFields = await getTableFields(sourceTable);

    if (sourceFields.length === 0) {
      throw new Error(`Brak pól w tabeli źródłowej ${sourceTable}.`);
    }

    // Upewnij się, że nazwa tabeli jest odpowiednio sformatowana
    const formattedTableName = formatTableName(tableName);

    console.log(`Tworzenie nowej tabeli: ${formattedTableName}...`);

    // Sprawdzamy czy tabela już istnieje
    try {
      await airtableBase(formattedTableName)
        .select({
          maxRecords: 1,
        })
        .all();
      console.log(`Tabela ${formattedTableName} już istnieje.`);
      return true; // Tabela istnieje
    } catch (error) {
      // Jeśli tabela nie istnieje, próbujemy ją utworzyć za pomocą REST API
      console.log(
        `Tabela ${formattedTableName} nie istnieje. Próbuję ją utworzyć...`
      );

      // Próbujemy utworzyć tabelę za pomocą REST API
      const success = await createTableViaRestApi(
        formattedTableName,
        sourceTable
      );

      if (success) {
        return true;
      } else {
        // Jeśli nie udało się utworzyć tabeli, generujemy instrukcje
        console.log(
          `Nie udało się utworzyć tabeli automatycznie. Generuję instrukcje...`
        );

        // Wyświetlamy instrukcje dla użytkownika
        console.log("\n===== INSTRUKCJA UTWORZENIA NOWEJ TABELI =====");
        console.log(
          `1. Zaloguj się do Airtable i otwórz bazę: ${AIRTABLE_BASE_ID}`
        );
        console.log(`2. Utwórz nową tabelę o nazwie: ${formattedTableName}`);
        console.log("3. Dodaj następujące pola (kolumny) do nowej tabeli:");

        // Sugerowane typy pól
        const fieldTypes = {
          author: "Tekst jednowierszowy",
          viewsCount: "Liczba",
          otherHashtags: "Tekst jednowierszowy",
          description: "Długi tekst",
          url: "URL",
          createdAt: "Data",
          subtitles: "Długi tekst",
        };

        sourceFields.forEach((field) => {
          console.log(
            `   - ${field} (typ: ${fieldTypes[field] || "Tekst jednowierszowy"})`
          );
        });

        console.log("\nPo utworzeniu tabeli, uruchom skrypt ponownie.");
        console.log("=======================================\n");

        // Zapisz instrukcje do pliku dla późniejszego użycia
        const instructionsFile = path.join(
          __dirname,
          `create_table_${formattedTableName}.txt`
        );
        const instructions = `
===== INSTRUKCJA UTWORZENIA NOWEJ TABELI =====
1. Zaloguj się do Airtable i otwórz bazę: ${AIRTABLE_BASE_ID}
2. Utwórz nową tabelę o nazwie: ${formattedTableName}
3. Dodaj następujące pola (kolumny) do nowej tabeli:
${sourceFields.map((field) => `   - ${field} (typ: ${fieldTypes[field] || "Tekst jednowierszowy"})`).join("\n")}

Po utworzeniu tabeli, uruchom skrypt ponownie.
=======================================
        `;

        fs.writeFileSync(instructionsFile, instructions);
        console.log(`Zapisano instrukcje do pliku: ${instructionsFile}`);

        return false; // Tabela nie istnieje i nie mogliśmy jej utworzyć
      }
    }
  } catch (error) {
    console.error(`Błąd podczas tworzenia tabeli ${tableName}:`, error);
    return false;
  }
}

// Formatowanie nazwy tabeli (usunięcie niedozwolonych znaków, spacji, etc.)
function formatTableName(tableName) {
  // Usuń znaki specjalne i spacje, pozostaw litery i cyfry
  let formatted = tableName.replace(/[^a-zA-Z0-9]/g, "");

  // Upewnij się, że pierwsza litera jest wielka (konwencja Airtable)
  if (formatted.length > 0) {
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  return formatted;
}

// Funkcja do pobierania pól tabeli
async function getTableFields(tableName) {
  try {
    const records = await airtableBase(tableName)
      .select({
        maxRecords: 1,
      })
      .all();

    if (records.length === 0) {
      return [];
    }

    const fields = records[0].fields;
    return Object.keys(fields);
  } catch (error) {
    console.error(`Błąd podczas pobierania pól tabeli ${tableName}:`, error);
    return [];
  }
}

// Funkcja do pobierania wszystkich serii z tabeli hashtagSeries
async function getAllSeries() {
  try {
    const records = await airtableBase(AIRTABLE_HASHTAG_SERIES_TABLE)
      .select()
      .all();
    return records.map((record) => ({
      id: record.id,
      name: record.fields.seriesName || "",
      tableName: formatTableName(record.fields.seriesName || ""),
    }));
  } catch (error) {
    console.error("Błąd podczas pobierania serii z Airtable:", error);
    return [];
  }
}

// Funkcja główna
async function main() {
  try {
    console.log("Sprawdzanie i tworzenie tabel dla wszystkich serii...");

    // Pobierz wszystkie serie
    const series = await getAllSeries();
    console.log(
      `Znaleziono ${series.length} serii w tabeli ${AIRTABLE_HASHTAG_SERIES_TABLE}.`
    );

    if (series.length === 0) {
      console.log("Brak serii do przetworzenia.");
      return;
    }

    // Przetwórz każdą serię
    for (const serie of series) {
      if (!serie.name) {
        console.log(`Seria bez nazwy, pomijam...`);
        continue;
      }

      console.log(
        `\nPrzetwarzanie serii: ${serie.name} (tabela: ${serie.tableName})`
      );
      const tableExists = await createTable(serie.tableName);

      if (tableExists) {
        console.log(
          `Tabela ${serie.tableName} istnieje i jest gotowa do użycia.`
        );
      } else {
        console.log(
          `Tabela ${serie.tableName} nie istnieje. Postępuj zgodnie z instrukcjami utworzenia.`
        );
      }
    }

    console.log("\nZakończono sprawdzanie i tworzenie tabel.");
  } catch (error) {
    console.error("Wystąpił błąd:", error);
  }
}

// Uruchomienie skryptu
if (require.main === module) {
  main();
}

module.exports = {
  createTable,
  formatTableName,
  getTableFields,
  getAllSeries,
  createTableViaRestApi,
};
