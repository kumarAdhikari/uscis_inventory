// Dashboard.jsx (Frontend integration with backend upload/delete)
import React, { useState, useEffect } from "react";
import {
    LineChart, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Line, ResponsiveContainer,
} from "recharts";

import {
    Select, SelectTrigger, SelectContent, SelectItem, SelectValue
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteFileFromServer, uploadFileToServer, fetchFilesFromServer } from "@/utils/api.js";
import "./Dashboard.css";
import sha256 from "crypto-js/sha256";
function Dashboard() {
    const [storedFiles, setStoredFiles] = useState([]);
    const [pendingFile, setPendingFile] = useState(null);
    const [adminPassword, setAdminPassword] = useState("");
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
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const years = Array.from({ length: 2024 - 2015 + 1 }, (_, i) => (2015 + i).toString());


    useEffect(() => {
        fetchFilesFromServer()
            .then(data => {
                const flatData = data.flatMap(file => file.data);
                const filenames = data.map(file => file.filename);

                setStoredFiles(filenames);
                setAllData(flatData);

                const categories = new Set(flatData.map(row => row.VisaCategory));
                setVisaCategories([...categories]);

                const latestFile = getLatestFileByDate(filenames);
                setLatestSourceFile(latestFile);

                applyFilters(flatData.filter(r => r.SourceFile === latestFile));
                updateTrendChart(flatData);
            })
            .catch(err => console.error("Failed to load files:", err));
    }, []);

    const getLatestFileByDate = (files = []) => {
        if (!Array.isArray(files) || files.length === 0) return null;

        const parseDate = (filename) => {
            const match = filename.match(/eb_inventory_(\w+)_([0-9]{4})/);
            if (!match) return null;

            const [, monthStr, yearStr] = match;
            const monthIndex = new Date(`${monthStr} 1`).getMonth();
            if (isNaN(monthIndex)) return null;

            return new Date(parseInt(yearStr), monthIndex, 1);
        };

        const sorted = files
            .map(file => typeof file === "string" ? file : file.key)
            .filter(name => parseDate(name) !== null)
            .sort((a, b) => parseDate(b) - parseDate(a));

        return sorted[0] || null;
    };
    const refreshData = () => {
        fetchFilesFromServer()
            .then(data => {
                const flatData = data.flatMap(file => file.data);
                const filenames = data.map(file => file.filename);

                setStoredFiles(filenames);
                setAllData(flatData);

                const categories = new Set(flatData.map(row => row.VisaCategory));
                setVisaCategories([...categories]);

                const latestFile = getLatestFileByDate(filenames);
                setLatestSourceFile(latestFile);

                applyFilters(flatData.filter(r => r.SourceFile === latestFile));
                updateTrendChart(flatData);
            })
            .catch(err => console.error("Failed to load files:", err));
    };

    useEffect(() => {
        refreshData();
    }, []);
    const visaDisplayMap = {
        EB1: "EB1 – Priority Workers",
        EB2: "EB2 – Advanced Degree or Exceptional Ability",
        EB3: "EB3 – Skilled Workers",
        EW3: "EB3 – Other Workers",
        CRW: "EB4 – Religious Workers",
        EB5: "EB5 – Immigrant Investors",
    };
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
    const convertToSortDate = (month, year) => {
        return `${year}-${String(new Date(`${month} 1`).getMonth() + 1).padStart(2, '0')}`;
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
            SourceFile: file.replace("eb_inventory_", "").replace(/_/g, " ").replace(".xlsx", "").replace(/\b\w/g, c => c.toUpperCase()),
            Inventory: inv
        })).sort((a, b) => a.SourceFile.localeCompare(b.SourceFile));

        setTrendData(trend);
    };

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

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        setPendingFile(file);
    };

    const handleUpload = async () => {
        if (!pendingFile) return;

        const hashed = sha256(adminPassword).toString();
        setLoading(true);
        setMessage(null);

        try {
            const result = await uploadFileToServer(pendingFile, hashed);

            setMessage("Uploaded successfully!");
            setPendingFile(null);
            refreshData();
        } catch (err) {
            setMessage(`Upload failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (filename,enteredPassword) => {
        if (!enteredPassword) return;
        console.log(enteredPassword);
        const confirmDelete = window.confirm(`Are you sure you want to delete "${filename}"?`);
        if (!confirmDelete) return;

        const hashed = sha256(enteredPassword).toString();
        console.log("Hashed");
        console.log(hashed);
        setLoading(true);
        setMessage(null);

        try {
            await deleteFileFromServer(filename, hashed);
            setMessage("Deleted successfully!");
            refreshData();
        } catch (err) {
            setMessage(`Delete failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dashboard-container container mx-auto px-4 py-6 overflow-x-hidden max-w-screen-xl">
            {loading && <div className="text-blue-600 font-semibold mb-2">Loading...</div>}
            {message && <div className="text-green-600 font-semibold mb-4">{message}</div>}
            <Card className="card">
                <CardContent className="filter-section">
                    <div className="upload-container">
                        <label className="label"> --- Select USCIS Inventory Dataset </label>
                        <Input type="file" accept=".xlsx" onChange={handleFileSelect} />
                        <label className="label">  Password</label>
                        <Input
                            type="password"
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            className="w-full"
                        />
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
                    <div>Source File: {latestSourceFile?.replace("eb_inventory_", "")
                        .replace(/_/g, " ")
                        .replace(".xlsx", "")
                        .replace(/\b\w/g, (char) => char.toUpperCase()) || "No file selected"}
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
                                <Legend payload={[{ value: "Pending Cases", type: "square", id: "Inventory", color: "#e00a0a" }]} />
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
                                {storedFiles.map(file => (
                                    <li key={file} className="uploaded-item">
                <span>
                    {file
                        .replace("eb_inventory_", "")
                        .replace(/_/g, " ")
                        .replace(".xlsx", "")
                        .replace(/\b\w/g, c => c.toUpperCase())}
                </span>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => {
                                                const enteredPassword = prompt("Enter admin password to delete this file:");
                                                if (!enteredPassword) return;
                                                handleDelete(file, enteredPassword);
                                            }}
                                        >
                                            Delete
                                        </Button>
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
