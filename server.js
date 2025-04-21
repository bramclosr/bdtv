import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import channelRoutes from './routes/channels.js'; // Use .js extension
import streamRoutes from './routes/stream.js';   // Use .js extension
// db instance is imported by routes/scripts as needed

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json()); // For parsing application/json

// Static serving HLS segments (Task 1.5)
// Ensure stream_data exists (can be done at startup or via deployment script)
app.use('/hls', express.static(path.join(__dirname, 'stream_data')));

// API Routes
app.use('/api/channels', channelRoutes);
app.use('/api/stream', streamRoutes);

// Basic root route
app.get('/', (req, res) => {
  res.send('Restreaming Server is Running');
});

// Error Handling Middleware (Basic)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start Server function (no longer needs async for DB init)
function startServer() {
  try {
    // Migrations handle DB setup now.
    // Parsing M3U is done via the script.
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer(); 