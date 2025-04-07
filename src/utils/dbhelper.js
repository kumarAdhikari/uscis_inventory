const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("EBInventoryDB", 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("files")) {
                db.createObjectStore("files", { keyPath: "key" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject("IndexedDB error");
    });
};

const saveToDB = async (key, data) => {
    const db = await openDB();
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    store.put({ key, data });
    await tx.complete;
};

const getAllFilesFromDB = async () => {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction("files", "readonly");
        const store = tx.objectStore("files");
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
    });
};

const deleteFromDB = async (key) => {
    const db = await openDB();
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    store.delete(key);
    await tx.complete;
};

const getFileFromDB = async (key) => {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction("files", "readonly");
        const store = tx.objectStore("files");
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result?.data || null);
    });
};

export {
    openDB,
    saveToDB,
    getAllFilesFromDB,
    deleteFromDB,
    getFileFromDB
};
