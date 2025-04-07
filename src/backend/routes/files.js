// routes/files.js
import express from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import authMiddleware, { checkPassword } from '../middleware/auth.js';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, '../uploads');


const router = express.Router();

const upload = multer({ dest: 'uploads/' });

router.post('/upload',checkPassword ,upload.single('file'), (req, res) => {
    console.log('Upload request received');

    const file = req.file;
    console.log('✅ File uploaded:', file.originalname);

    try {
        const workbook = XLSX.readFile(file.path);
        const sheetName = workbook.SheetNames.find(name => name !== 'How to Read This Report');
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "", range: 3 });

        // Transform the data
        const parsedData = [];
        const parseVisaCategory = (full) => {
            if (!full) return "";
            const match = full.match(/\(([A-Z0-9]+)\)/);
            return match ? match[1] : full;
        };

        const convertToSortDate = (month, year) => {
            return `${year}-${String(new Date(`${month} 1`).getMonth() + 1).padStart(2, '0')}`;
        };

        json.forEach(row => {
            const country = row["Country Of Chargeability"];
            const preference = row["Preference Category"];
            const status = row["Visa Status"];
            const month = row["Priority Date Month"];
            if (!country || !preference || !month) return;

            const category = parseVisaCategory(preference);
            for (let year = 2015; year <= 2024; year++) {
                const key = `Priority Date Year - ${year}`;
                const value = parseInt(row[key]);
                if (!isNaN(value)) {
                    parsedData.push({
                        Country: country,
                        VisaCategory: category,
                        Status: status,
                        Date: `${month} ${year}`,
                        SortDate: convertToSortDate(month, year),
                        Inventory: value,
                        SourceFile: file.originalname
                    });
                }
            }
        });
        // Move the file from temp to persistent location
        const targetPath = path.join(UPLOAD_DIR, file.originalname);
        fs.renameSync(file.path, targetPath); // overwrites if exists

        return res.status(200).json({
            success: true,
            filename: file.originalname,
            data: parsedData
        });

    } catch (err) {
        console.error("Error processing Excel file:", err);
        return res.status(500).json({ success: false, message: "Error processing file" });
    }
});

router.delete('/:filename', checkPassword,(req, res) => {
    const password = req.headers['x-admin-password'];

    const { filename } = req.params;
    const filePath = path.join(UPLOAD_DIR, filename);

    fs.unlink(filePath, (err) => {
        if (err) {
            console.error("Delete error:", err);
            return res.status(500).json({ message: "Failed to delete file" });
        }
        return res.json({ message: "File deleted" });
    });
});

router.get("/", (req, res) => {
    const files = fs.readdirSync(UPLOAD_DIR).filter(f => f.endsWith(".xlsx"));;
    const result = [];
    const extractCategory = (preference) => {
        if (!preference) return "";
        const match = preference.match(/\(([A-Z0-9]+)\)/);
        return match ? match[1] : preference;
    };
    files.forEach(file => {
        const filepath = path.join(UPLOAD_DIR, file);
        const workbook = XLSX.readFile(filepath);
        const sheetName = workbook.SheetNames.find(n => n !== "How to Read This Report");
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "", range: 3 });

        const processed = [];
        json.forEach(row => {
            const category = extractCategory(row["Preference Category"]);
            const month = row["Priority Date Month"];
            if (!category || !month) return;

            for (let year = 2015; year <= 2024; year++) {
                const key = `Priority Date Year - ${year}`;
                const value = parseInt(row[key]);
                if (!isNaN(value)) {
                    processed.push({
                        Country: row["Country Of Chargeability"],
                        VisaCategory: category,
                        Status: row["Visa Status"],
                        Date: `${month} ${year}`,
                        SortDate: `${year}-${String(new Date(`${month} 1`).getMonth() + 1).padStart(2, '0')}`,
                        Inventory: value,
                        SourceFile: file
                    });
                }
            }
        });

        result.push({ filename: file, data: processed });
    });
    res.json(result);
});


export default router;
