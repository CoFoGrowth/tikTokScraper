const Airtable = require("airtable");

// Konfiguracja Airtable
const AIRTABLE_API_KEY =
  "patuIzeLWvjgGXGWf.5f11369f405a4930cbc312dab319e7d5f1b40376011289ebde30ed2b43c320c8";
const AIRTABLE_BASE_ID = "appIVjreDvDlqC305";

const airtableBase = new Airtable({
  apiKey: AIRTABLE_API_KEY,
}).base(AIRTABLE_BASE_ID);

// Funkcja do pobierania pól z tabeli
async function getTableFields(tableName) {
  try {
    console.log(`Pobieranie struktury tabeli ${tableName}...`);

    const records = await airtableBase(tableName)
      .select({
        maxRecords: 1,
        view: "Grid view",
      })
      .all();

    if (records.length === 0) {
      console.log(`Brak rekordów w tabeli ${tableName}.`);
      return [];
    }

    const fields = records[0].fields;
    const fieldNames = Object.keys(fields);
    console.log(`Znaleziono ${fieldNames.length} pól w tabeli ${tableName}:`);
    console.log(fieldNames);

    return fieldNames;
  } catch (error) {
    console.error(
      `Błąd podczas pobierania struktury tabeli ${tableName}:`,
      error
    );
    return [];
  }
}

// Funkcja główna
async function main() {
  try {
    console.log("======== INSTRUKCJA TWORZENIA PÓL W TABELI ========");
    console.log(
      "Aby skrypt działał poprawnie, musisz utworzyć te same pola w tabeli HipnozaForClient0001, co w tabeli AutomatyzacjaBiznesu."
    );

    const sourceTable = "AutomatyzacjaBiznesu";
    const targetTable = "HipnozaForClient0001";

    console.log(`\nPobieram pola z tabeli źródłowej (${sourceTable})...`);
    const sourceFields = await getTableFields(sourceTable);

    if (sourceFields.length === 0) {
      console.log(
        "Nie udało się pobrać pól z tabeli źródłowej. Sprawdź uprawnienia i nazwę tabeli."
      );
      return;
    }

    console.log(`\nPobieram pola z tabeli docelowej (${targetTable})...`);
    const targetFields = await getTableFields(targetTable);

    // Znajdź pola, które brakuje w tabeli docelowej
    const missingFields = sourceFields.filter(
      (field) => !targetFields.includes(field)
    );

    if (missingFields.length === 0) {
      console.log(
        `\nWszystkie potrzebne pola już istnieją w tabeli ${targetTable}!`
      );
    } else {
      console.log(`\nW tabeli ${targetTable} brakuje następujących pól:`);
      missingFields.forEach((field, index) => {
        console.log(`${index + 1}. ${field}`);
      });

      console.log("\n======== INSTRUKCJA RĘCZNEGO TWORZENIA PÓL ========");
      console.log("1. Zaloguj się do Airtable i otwórz bazę danych.");
      console.log(`2. Przejdź do tabeli ${targetTable}.`);
      console.log("3. Kliknij na '+ Dodaj pole' w prawym górnym rogu tabeli.");
      console.log("4. Utwórz pola o następujących nazwach i typach:");

      // Sugerowane typy pól na podstawie ich nazw
      const fieldTypes = {
        author: "Tekst jednowierszowy",
        viewsCount: "Liczba",
        otherHashtags: "Tekst jednowierszowy",
        description: "Długi tekst",
        url: "URL",
        createdAt: "Data",
        subtitles: "Długi tekst",
      };

      missingFields.forEach((field, index) => {
        console.log(
          `   ${index + 1}. ${field} - Typ: ${fieldTypes[field] || "Tekst jednowierszowy"}`
        );
      });

      console.log(
        "\n5. Po utworzeniu wszystkich pól, uruchom skrypt ponownie, aby upewnić się, że wszystkie pola zostały utworzone."
      );
      console.log("\n======== ALTERNATYWNE ROZWIĄZANIE ========");
      console.log(
        "Możesz też tymczasowo używać tylko tabeli AutomatyzacjaBiznesu, modyfikując funkcję saveToAirtable w pliku index.js."
      );
    }
  } catch (error) {
    console.error("Wystąpił błąd:", error);
  }
}

// Uruchomienie skryptu
main();
