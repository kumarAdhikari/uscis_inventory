import axios from 'axios';


const API_BASE = 'http://localhost:5050/api/files'; // your backend endpoint

// frontend helper
// api.js
export const uploadFileToServer = async (file, hashedPassword) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: {
            'x-admin-password': hashedPassword
        },
        body: formData
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Upload failed');
    }

    return await response.json();
};




export const deleteFileFromServer = async (key, password) => {
    try {
        const res = await axios.delete(`${API_BASE}/${key}`, {
            headers: {
                'x-admin-password': password
            }
        });
        return res.data;
    } catch (err) {
        console.error('Delete error:', err);
        throw err.response?.data?.message || 'Delete failed';
    }
};



// 🔥 New: Get all uploaded and parsed data
export const fetchFilesFromServer = async () => {
    const res = await fetch(`${API_BASE}`);
    if (!res.ok) {
        throw new Error('Failed to fetch files');
    }
    return await res.json(); // should return [{ filename, data: [...] }]
};
