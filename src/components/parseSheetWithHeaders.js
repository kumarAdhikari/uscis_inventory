import * as XLSX from "xlsx";

export function parseSheetWithHeaders(file, sheetName) {
    const workbook = XLSX.read(file, { type: "binary" });
    const sheet = workbook.Sheets[sheetName];

    // Raw 2D array of rows
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Find header row
    const headerIndex = rawRows.findIndex(row =>
        row.includes("Preference Category") && row.includes("Priority Date Month")
    );

    if (headerIndex === -1) {
        console.error("❌ Could not find header row in sheet:", sheetName);
        return [];
    }

    const headers = rawRows[headerIndex];

    // Map rest of rows into objects
    const dataRows = rawRows.slice(headerIndex + 1).map(row => {
        const obj = {};
        headers.forEach((key, i) => {
            if (key && key.trim() !== "") {
                obj[key.trim()] = row[i];
            }
        });
        return obj;
    });

    console.log(`✅ Parsed ${dataRows.length} rows from "${sheetName}"`);
    return dataRows;
}
