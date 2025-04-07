import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
    LineChart, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Line, ResponsiveContainer,
} from "recharts";

import {
    Select, SelectTrigger, SelectContent, SelectItem, SelectValue
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {openDB, saveToDB, getAllFilesFromDB, deleteFromDB, getFileFromDB} from "../utils/dbhelper.js";
import "./Dashboard.css";
function Dashboard() {
    const [storedFiles, setStoredFiles] = useState([]);
    const [allData, setAllData] = useState([]);
    const [trendData, setTrendData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [visaCategories, setVisaCategories] = useState([]);
    const [selectedVisa, setSelectedVisa] = useState("__all__");
    const [startMonth, setStartMonth] = useState("January");
    const [startYear, setStartYear] = useState("2021");
    const [endMonth, setEndMonth] = useState("December");
    const [endYear, setEndYear] = useState("2021");
    const [totalInventory, setTotalInventory] = useState(0);
    const [latestSourceFile, setLatestSourceFile] = useState("");
    const [pendingFile, setPendingFile] = useState(null);

    const visaDisplayMap = {
        EB1: "EB1 – Priority Workers",
        EB2: "EB2 – Advanced Degree or Exceptional Ability",
        EB3: "EB3 – Skilled Workers",
        EW3: "EB3 – Other Workers",
        CRW: "EB4 – Religious Workers",
        EB5: "EB5 – Immigrant Investors",
    };

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const years = Array.from({ length: 2024 - 2015 + 1 }, (_, i) => (2015 + i).toString());

    useEffect(() => {
        getAllFilesFromDB().then(files => {
            const filesWithDates = files.map(({ key }) => {
                const parts = key.split("_");
                const month = parts[2];
                const year = parts[3];
                return { key, month, year, dateStr: `${year}-${String(new Date(`${month} 1`).getMonth() + 1).padStart(2, '0')}` };
            });
            const latest = filesWithDates.sort((a, b) => b.dateStr.localeCompare(a.dateStr))[0];
            setStoredFiles(filesWithDates);
            if (latest) {
                loadAllStoredData(filesWithDates.map(f => f.key), latest.key|| "");
            }
        }).catch(err => {
            console.error("Failed to load files from IndexedDB", err);
        });
    }, []);

    const { chartData: filteredDataGroupedByMonth = [], years: stackedYears = [] } = React.useMemo(() => {
        const grouped = {};
        filteredData.forEach(({ Date, Inventory }) => {
            const [month, year] = Date.split(" ");
            if (!grouped[month]) grouped[month] = {};
            if (!grouped[month][year]) grouped[month][year] = 0;
            grouped[month][year] += Inventory;
        });

        const allYears = new Set();
        const chartData = Object.entries(grouped).map(([month, yearData]) => {
            const entry = { Month: month };
            Object.entries(yearData).forEach(([year, count]) => {
                entry[year] = count;
                allYears.add(year);
            });
            return entry;
        });

        const monthOrder = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        chartData.sort((a, b) => monthOrder.indexOf(a.Month) - monthOrder.indexOf(b.Month));

        return { chartData, years: Array.from(allYears).sort() };
    }, [filteredData]);


    const yearColors = {
        "2015": "#f87171",
        "2016": "#fb923c",
        "2017": "#facc15",
        "2018": "#4ade80",
        "2019": "#60a5fa",
        "2020": "#a78bfa",
        "2021": "#f472b6",
        "2022": "#34d399",
        "2023": "#fcd34d",
        "2024": "#c084fc"
    };
    const parseVisaCategory = (full) => {
        if (!full) return "";
        const match = full.match(/\(([A-Z0-9]+)\)/);
        return match ? match[1] : full;
    };

    const convertToSortDate = (month, year) => {
        return `${year}-${String(new Date(`${month} 1`).getMonth() + 1).padStart(2, '0')}`;
    };

    const processSheet = (sheet, sourceFile) => {
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "", range: 3 });
        const output = [];

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
                    output.push({
                        Country: country,
                        VisaCategory: category,
                        Status: status,
                        Date: `${month} ${year}`,
                        SortDate: convertToSortDate(month, year),
                        Inventory: value,
                        SourceFile: sourceFile
                    });
                }
            }
        });

        return output;
    };

    const loadAllStoredData = async (keys, latestFileKey) => {
        const allRows = [];
        for (const key of keys) {
            try {
                const content = await getFileFromDB(key);
                const sheetName = content.SheetNames.find(n => n !== "How to Read This Report");
                const sheet = content.Sheets[sheetName];
                allRows.push(...processSheet(sheet, key));
            } catch (e) {
                console.error("Error processing:", key);
            }
        }

        setAllData(allRows);
        setVisaCategories([...new Set(allRows.map(row => row.VisaCategory))]);

        const latestData = allRows.filter(r => r.SourceFile === latestFileKey);
        setLatestSourceFile(latestFileKey);
        applyFilters(latestData);
        updateTrendChart(allRows);
    };


    const updateTrendChart = (data) => {
        const from = convertToSortDate(startMonth, startYear);
        const to = convertToSortDate(endMonth, endYear);

        const grouped = {};
        data.forEach(row => {
            if (row.SortDate >= from && row.SortDate <= to && (selectedVisa === "__all__" || row.VisaCategory === selectedVisa)) {
                grouped[row.SourceFile] = (grouped[row.SourceFile] || 0) + row.Inventory;
            }
        });

        const trend = Object.entries(grouped).map(([file, inv]) => ({
            SourceFile: file.replace("eb_inventory_", "").replace(/_/g, " "),
            Inventory: inv
        })).sort((a, b) => a.SourceFile.localeCompare(b.SourceFile));

        setTrendData(trend);
    };

    const applyFilters = (data) => {
        const from = convertToSortDate(startMonth, startYear);
        const to = convertToSortDate(endMonth, endYear);
        const filtered = data.filter(row => {
            const dateMatch = row.SortDate >= from && row.SortDate <= to;
            const visaMatch = selectedVisa === "__all__" || row.VisaCategory === selectedVisa;
            return dateMatch && visaMatch;
        });
        setFilteredData(filtered);
        setTotalInventory(filtered.reduce((acc, r) => acc + r.Inventory, 0));
    };

    const handleFilter = () => {
        const data = allData.filter(r => r.SourceFile === latestSourceFile);
        applyFilters(data);
        updateTrendChart(allData);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        setPendingFile(file);
    };


    const handleUpload = () => {
        if (!pendingFile) return;

        const file = pendingFile;
        const name = file.name.replace(/\s+/g, "_").toLowerCase().replace(".xlsx", "");
        const key = name.startsWith("eb_inventory_") ? name : `eb_inventory_${name}`;

        getFileFromDB(key).then(existing => {
            if (existing) {
                alert("This file has already been uploaded.");
                return;
            }

            const reader = new FileReader();
            reader.onload = async (evt) => {
                const data = new Uint8Array(evt.target.result);
                const wb = XLSX.read(data, { type: "array" });

                await saveToDB(key, wb);

                const timestamped = [...storedFiles, { key, dateStr: new Date().toISOString() }];
                setStoredFiles(timestamped);
                setPendingFile(null);
                loadAllStoredData(timestamped.map(f => f.key), key);
            };
            reader.readAsArrayBuffer(file);
        });
    };



    const handleDelete = (key) => {
        if (window.confirm(`Are you sure you want to delete ${key}?`)) {
            deleteFromDB(key).then(() => {
                const updated = storedFiles.filter(f => f.key !== key);
                setStoredFiles(updated);
                loadAllStoredData(updated.map(f => f.key), updated.length > 0 ? updated[0].key : "");
            });
        }
    };


    return (
        <div className="dashboard-container container mx-auto px-4 py-6 overflow-x-hidden max-w-screen-xl">
            <Card className="card">
                <CardContent className="filter-section">
                    <div className="upload-container">
                        <label className="label">Select File</label>
                        <Input type="file" accept=".xlsx" onChange={handleFileSelect} />
                        <Button className="upload-button" onClick={handleUpload} disabled={!pendingFile}>Upload Selected File</Button>
                    </div>

                    <div>
                        <label className="label">Visa Category</label>
                        <Select value={selectedVisa} onValueChange={setSelectedVisa}>
                            <SelectTrigger className="dropdown">
                                <SelectValue placeholder="Select Visa Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">All Categories</SelectItem>
                                {visaCategories.map(vc => (
                                    <SelectItem key={vc} value={vc}>{visaDisplayMap[vc] || vc}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Date selectors remain unchanged but styled */}
                    <div className="date-select-group">
                        <div className="flex-1">
                            <label className="label">Start Month</label>
                            <Select value={startMonth} onValueChange={setStartMonth}>
                                <SelectTrigger className="dropdown">
                                    <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent>
                                    {months.map(month => (
                                        <SelectItem key={month} value={month}>{month}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1">
                            <label className="label">Start Year</label>
                            <Select value={startYear} onValueChange={setStartYear}>
                                <SelectTrigger className="dropdown">
                                    <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {years.map(year => (
                                        <SelectItem key={year} value={year}>{year}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="date-select-group">
                        <div className="flex-1">
                            <label className="label">End Month</label>
                            <Select value={endMonth} onValueChange={setEndMonth}>
                                <SelectTrigger className="dropdown">
                                    <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent>
                                    {months.map(month => (
                                        <SelectItem key={month} value={month}>{month}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1">
                            <label className="label">End Year</label>
                            <Select value={endYear} onValueChange={setEndYear}>
                                <SelectTrigger className="dropdown">
                                    <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {years.map(year => (
                                        <SelectItem key={year} value={year}>{year}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="col-span-full">
                        <Button className="apply-button" onClick={handleFilter}>Apply Filters</Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="card">
                <CardContent className="summary-box">
                    <div>Total Cases (Filtered): {totalInventory.toLocaleString()}</div>
                    <div>Source File: {latestSourceFile
                        .replace("eb_inventory_", "")
                        .replace(/_/g, " ")
                        .replace(".xlsx", "")
                        .replace(/\b\w/g, (char) => char.toUpperCase())}
                    </div>
                </CardContent>
            </Card>

            {filteredDataGroupedByMonth.length > 0 && (
                <Card className="card">
                    <CardContent>
                        <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={filteredDataGroupedByMonth} barCategoryGap={8}>
                                <XAxis dataKey="Month" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                {stackedYears.map(year => (
                                    <Bar key={year} dataKey={year} stackId="cases" fill={yearColors[year]} name={`${year} Pending Cases`} />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {trendData.length > 0 && (
                <Card className="card">
                    <CardContent>
                        <h2 className="section-title">Case Trend Across Months(Timeline)</h2>
                        <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={[...trendData].sort((a, b) => new Date(a.SourceFile) - new Date(b.SourceFile))} margin={{ top: 10, right: 30, left: 20, bottom: 80 }}>
                                <XAxis dataKey="SourceFile" angle={-45} textAnchor="end" interval={0} height={100} />
                                <YAxis domain={['auto', 'auto']} />
                                <Tooltip />
                                <Legend payload={[{ value: "Pending Cases", type: "square", id: "Inventory", color: "#4f46e5" }]} />
                                <Line type="monotone" dataKey="Inventory" stroke="#16a34a" strokeWidth={2} dot name="Pending Cases" />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            <Card className="card">
                <CardContent>
                    <details className="uploaded-section">
                        <summary className="uploaded-summary">
                            <span>Uploaded Files</span>
                            <svg className="arrow-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </summary>
                        <div className="uploaded-list">
                            <ul className="space-y-2 mt-2">
                                {storedFiles.map(f => (
                                    <li key={f.key} className="uploaded-item">
                                        <span>{f.key.replace("eb_inventory_", "").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}</span>
                                        <Button variant="destructive" size="sm" onClick={() => handleDelete(f.key)}>Delete</Button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </details>
                </CardContent>
            </Card>
        </div>
    );
}

export default Dashboard;
