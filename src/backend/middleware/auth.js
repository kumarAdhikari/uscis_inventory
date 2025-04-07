// middleware/auth.js
import dotenv from 'dotenv';
dotenv.config();

export const requireAuth = (req, res, next) => {
    const clientPassword = req.headers['x-admin-password'];

    if (!clientPassword) {
        return res.status(401).json({ message: 'Admin password required' });
    }

    if (clientPassword !== process.env.ADMIN_PASSWORD) {
        return res.status(403).json({ message: 'Invalid admin password' });
    }

    next();
};
// backend/middleware/auth.js
export default function authMiddleware(req, res, next) {
    const password = req.headers['x-admin-password'];
    if (!password || password !== process.env.ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    next();
}
// middleware/auth.js
export const checkPassword = (req, res, next) => {
    try {
        const clientPassword = req.headers?.['x-admin-password'];  // safe access
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!clientPassword || clientPassword !== adminPassword) {
            return res.status(403).json({ message: 'Invalid password' });
        }

        next();
    } catch (err) {
        console.error("Error in checkPassword middleware:", err);
        return res.status(500).json({ message: "Server error in authentication." });
    }
};




