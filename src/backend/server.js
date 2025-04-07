import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fileRoutes from './routes/files.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;


app.use(cors());
app.use(express.json());

app.use('/api/files', fileRoutes);

app.get('/', (req, res) => {
    res.send('Visa Inventory Backend is Running...');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
