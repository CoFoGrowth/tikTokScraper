const axios = require("axios");

const apiKey =
  "patuIzeLWvjgGXGWf.5f11369f405a4930cbc312dab319e7d5f1b40376011289ebde30ed2b43c320c8";
const baseId = "appIVjreDvDlqC305";
const tableId = "tbl7b3Y1gCnSY4qoX";

// Query the Airtable metadata API
async function checkAirtableSchema() {
  try {
    // Get table metadata
    const response = await axios.get(
      `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Find our specific table
    const targetTable = response.data.tables.find(
      (table) => table.id === tableId
    );

    if (targetTable) {
      console.log("Table name:", targetTable.name);
      console.log("Table fields:");
      targetTable.fields.forEach((field) => {
        console.log(`- ${field.name} (${field.type})`);
      });
    } else {
      console.log("Table not found");
    }
  } catch (error) {
    console.error(
      "Error fetching Airtable schema:",
      error.response?.data || error.message
    );
  }
}

checkAirtableSchema();
