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

    // Zdefiniuj standardowy zestaw pól, który zawsze będzie używany dla nowych tabel
    // UWAGA: Pierwsze pole musi być typu tekstowego (primary field w Airtable)
    const standardFields = [
      "author", // Pierwsze pole - musi być typu tekstowego
      "platform", // Nowe pole do rozróżniania platform
      "viewsCount",
      "otherHashtags",
      "description",
      "url",
      "createdAt",
      "subtitles", // Zawsze dodajemy pole subtitles
    ];

    // Utwórz strukturę pól dla nowej tabeli na podstawie standardowych pól
    const fields = standardFields.map((fieldName) => {
      // Określanie typu pola na podstawie nazwy
      let type = "singleLineText";
      let fieldDef = { name: fieldName, type: type };

      if (fieldName === "viewsCount") {
        fieldDef.type = "number";
        fieldDef.options = {
          precision: 0,
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
      } else if (fieldName === "platform") {
        fieldDef.type = "singleSelect";
        fieldDef.options = {
          choices: [
            { name: "tiktok", color: "blueLight2" },
            { name: "instagram", color: "pinkLight2" },
            { name: "youtube", color: "redLight2" },
          ],
        };
      }

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
      // Unieważnij cache ID tabel po utworzeniu nowej tabeli
      invalidateTableIdCache();
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
    // UWAGA: Pierwsze pole musi być typu tekstowego (primary field w Airtable)
    const standardFields = [
      "author", // Pierwsze pole - musi być typu tekstowego
      "platform", // Nowe pole do rozróżniania platform
      "viewsCount",
      "otherHashtags",
      "description",
      "url",
      "createdAt",
      "subtitles",
    ];

    console.log(`Używam standardowego zestawu pól dla nowej tabeli...`);

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
      return true;
    } catch (error) {
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
        console.log(
          `Nie udało się utworzyć tabeli automatycznie. Generuję instrukcje...`
        );

        // Sugerowane typy pól
        const fieldTypes = {
          platform: "Lista wyboru (tiktok, instagram, youtube)",
          author: "Tekst jednowierszowy",
          viewsCount: "Liczba",
          otherHashtags: "Tekst jednowierszowy",
          description: "Długi tekst",
          url: "URL",
          createdAt: "Data",
          subtitles: "Długi tekst",
        };

        standardFields.forEach((field) => {
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
${standardFields.map((field) => `   - ${field} (typ: ${fieldTypes[field] || "Tekst jednowierszowy"})`).join("\n")}

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

// Cache dla ID tabel
let tableIdCache = null;

// Funkcja do pobierania mapowania nazw tabel na ID
async function getTableIdMapping() {
  if (tableIdCache) {
    return tableIdCache;
  }

  try {
    const response = await axios({
      method: "get",
      url: `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`,
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      },
    });

    if (response.status === 200 && response.data.tables) {
      tableIdCache = {};
      response.data.tables.forEach((table) => {
        tableIdCache[table.name] = table.id;
      });
      return tableIdCache;
    }
  } catch (error) {
    console.error("Błąd podczas pobierania mapowania ID tabel:", error.message);
  }

  return {};
}

// Funkcja do unieważnienia cache ID tabel (np. po utworzeniu nowej tabeli)
function invalidateTableIdCache() {
  tableIdCache = null;
}

// Funkcja do dodawania pola subtitles do istniejącej tabeli
async function addSubtitlesFieldToTable(tableName) {
  try {
    console.log(`Sprawdzanie pola subtitles w tabeli ${tableName}...`);

    // Sprawdź czy tabela ma już pole subtitles
    const existingFields = await getTableFields(tableName);

    if (existingFields.includes("subtitles")) {
      console.log(`Tabela ${tableName} już ma pole subtitles.`);
      return true;
    }

    console.log(`Tabela ${tableName} nie ma pola subtitles.`);

    // Wyświetl instrukcje ręcznego dodania pola subtitles
    console.log(
      `INSTRUKCJA: Ręcznie dodaj pole "subtitles" (typ: Długi tekst) do tabeli ${tableName} w Airtable:`
    );
    console.log(`1. Otwórz tabelę ${tableName} w Airtable`);
    console.log(
      `2. Kliknij ikonę "+" w górnej części tabeli aby dodać nową kolumnę`
    );
    console.log(`3. Nazwij pole "subtitles"`);
    console.log(`4. Wybierz typ pola "Długi tekst"`);
    console.log(`5. Zapisz zmiany`);

    // Spróbuj dodać pole za pomocą REST API używając ID tabeli zamiast nazwy
    try {
      console.log(
        `Próbuję automatycznie dodać pole subtitles do tabeli ${tableName}...`
      );

      // Pobierz ID tabeli na podstawie nazwy
      const tableIdMapping = await getTableIdMapping();
      const tableId = tableIdMapping[tableName];

      if (!tableId) {
        console.log(`⚠️  Nie można znaleźć ID dla tabeli ${tableName}`);
        return false;
      }

      console.log(`   Używam ID tabeli: ${tableId}`);

      const response = await axios({
        method: "post",
        url: `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${tableId}/fields`,
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        data: {
          name: "subtitles",
          type: "multilineText",
        },
      });

      if (response.status === 200 || response.status === 201) {
        console.log(
          `✅ Pole subtitles zostało pomyślnie dodane automatycznie do tabeli ${tableName}!`
        );
        return true;
      }
    } catch (apiError) {
      console.log(
        `⚠️  Automatyczne dodanie pola nie powiodło się. Prawdopodobnie wymagana jest autoryzacja Personal Access Token lub ręczne dodanie pola.`
      );
      console.log(
        `   Szczegóły błędu: ${apiError.response ? apiError.response.data.error.type || apiError.response.data.error : apiError.message}`
      );
    }

    console.log(`\n🔧 Aby automatycznie dodawać pola, możesz:`);

    return false;
  } catch (error) {
    console.error(
      `Błąd podczas sprawdzania pola subtitles w tabeli ${tableName}:`,
      error.message
    );
    console.log(
      `INSTRUKCJA: Ręcznie dodaj pole "subtitles" (typ: Długi tekst) do tabeli ${tableName} w Airtable.`
    );
    return false;
  }
}

// Funkcja do dodawania pola platform do istniejącej tabeli
async function addPlatformFieldToTable(tableName) {
  try {
    console.log(`Sprawdzanie pola platform w tabeli ${tableName}...`);

    // Sprawdź czy tabela ma już pole platform
    const existingFields = await getTableFields(tableName);

    if (existingFields.includes("platform")) {
      console.log(`Tabela ${tableName} już ma pole platform.`);
      return true;
    }

    console.log(`Tabela ${tableName} nie ma pola platform.`);

    // Wyświetl instrukcje ręcznego dodania pola platform
    console.log(
      `INSTRUKCJA: Ręcznie dodaj pole "platform" (typ: Lista wyboru) do tabeli ${tableName} w Airtable:`
    );
    console.log(`1. Otwórz tabelę ${tableName} w Airtable`);
    console.log(
      `2. Kliknij ikonę "+" w górnej części tabeli aby dodać nową kolumnę`
    );
    console.log(`3. Nazwij pole "platform"`);
    console.log(`4. Wybierz typ pola "Lista wyboru"`);
    console.log(`5. Dodaj opcje: tiktok, instagram, youtube`);
    console.log(`6. Zapisz zmiany`);

    // Spróbuj dodać pole za pomocą REST API używając ID tabeli zamiast nazwy
    try {
      console.log(
        `Próbuję automatycznie dodać pole platform do tabeli ${tableName}...`
      );

      // Pobierz ID tabeli na podstawie nazwy
      const tableIdMapping = await getTableIdMapping();
      const tableId = tableIdMapping[tableName];

      if (!tableId) {
        console.log(`⚠️  Nie można znaleźć ID dla tabeli ${tableName}`);
        return false;
      }

      console.log(`   Używam ID tabeli: ${tableId}`);

      const response = await axios({
        method: "post",
        url: `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${tableId}/fields`,
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        data: {
          name: "platform",
          type: "singleSelect",
          options: {
            choices: [
              { name: "tiktok", color: "blueLight2" },
              { name: "instagram", color: "pinkLight2" },
              { name: "youtube", color: "redLight2" },
            ],
          },
        },
      });

      if (response.status === 200 || response.status === 201) {
        console.log(
          `✅ Pole platform zostało pomyślnie dodane automatycznie do tabeli ${tableName}!`
        );
        return true;
      }
    } catch (apiError) {
      console.log(
        `⚠️  Automatyczne dodanie pola platform nie powiodło się. Prawdopodobnie wymagana jest autoryzacja Personal Access Token lub ręczne dodanie pola.`
      );
      console.log(
        `   Szczegóły błędu: ${apiError.response ? apiError.response.data.error.type || apiError.response.data.error : apiError.message}`
      );
    }

    console.log(`\n🔧 Aby automatycznie dodawać pola, możesz:`);

    return false;
  } catch (error) {
    console.error(
      `Błąd podczas sprawdzania pola platform w tabeli ${tableName}:`,
      error.message
    );
    console.log(
      `INSTRUKCJA: Ręcznie dodaj pole "platform" (typ: Lista wyboru) do tabeli ${tableName} w Airtable.`
    );
    return false;
  }
}

// Funkcja do sprawdzenia i aktualizacji wszystkich istniejących tabel
async function checkAndUpdateExistingTables() {
  try {
    console.log(
      "Sprawdzanie wszystkich istniejących tabel pod kątem pola subtitles..."
    );

    // Pobierz wszystkie serie
    const series = await getAllSeries();

    // Sprawdź także tabelę domyślną AutomatyzacjaBiznesu
    const tablesToCheck = ["AutomatyzacjaBiznesu"];

    // Dodaj wszystkie tabele z serii
    series.forEach((serie) => {
      if (serie.tableName) {
        tablesToCheck.push(serie.tableName);
      }
    });

    // Usuń duplikaty
    const uniqueTables = [...new Set(tablesToCheck)];

    console.log(
      `Sprawdzanie ${uniqueTables.length} tabel: ${uniqueTables.join(", ")}`
    );

    for (const tableName of uniqueTables) {
      try {
        await addSubtitlesFieldToTable(tableName);
        await addPlatformFieldToTable(tableName);
      } catch (error) {
        console.log(
          `Pomijam tabelę ${tableName} - prawdopodobnie nie istnieje.`
        );
      }
    }

    console.log("Zakończono sprawdzanie i aktualizację istniejących tabel.");
  } catch (error) {
    console.error("Błąd podczas sprawdzania istniejących tabel:", error);
  }
}

// Funkcja główna
async function main() {
  try {
    console.log("Sprawdzanie i tworzenie tabel dla wszystkich serii...");

    // Najpierw sprawdź i zaktualizuj istniejące tabele
    await checkAndUpdateExistingTables();

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
        // Sprawdź czy tabela ma pole subtitles i platform
        await addSubtitlesFieldToTable(serie.tableName);
        await addPlatformFieldToTable(serie.tableName);
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
  addSubtitlesFieldToTable,
  addPlatformFieldToTable,
  checkAndUpdateExistingTables,
  getTableIdMapping,
  invalidateTableIdCache,
};
