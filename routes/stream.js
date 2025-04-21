import express from 'express';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, schema } from '../db/db.js'; // Use Drizzle db and schema
import { eq } from 'drizzle-orm'; // Import Drizzle functions

const router = express.Router();

// ES Module equivalent for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Stream Management State ---
let activeStream = {
    channelId: null,
    ffmpegProcess: null,
    playlistPath: null,
    outputDir: null,
    timeoutId: null, // Optional: For delayed cleanup
};

// Helper function to stop the currently active stream
async function stopActiveStream() {
    if (activeStream.ffmpegProcess) {
        console.log(`Stopping existing stream for channel ID: ${activeStream.channelId}`);
        // Attempt graceful kill first, then force
        try {
            activeStream.ffmpegProcess.kill('SIGTERM');
        } catch (killError) {
             // Ignore error if process already exited
             if (!killError.message.includes('ESRCH')) { // ESRCH: No such process
                 console.error("Error sending SIGTERM:", killError);
             }
        }

        // Optional: Add a small delay and then force kill if needed
        // setTimeout(() => {
        //     if (activeStream.ffmpegProcess) { // Check if it still exists
        //         console.log(`Force killing stream for channel ID: ${activeStream.channelId}`);
        //         activeStream.ffmpegProcess.kill('SIGKILL');
        //     }
        // }, 2000); // 2 second grace period

        activeStream.ffmpegProcess = null;
    }

    // Optional: Clear timeout if stream is stopped manually
    if (activeStream.timeoutId) {
        clearTimeout(activeStream.timeoutId);
        activeStream.timeoutId = null;
    }

    // Clean up the HLS directory after a short delay to allow ongoing requests to finish
    if (activeStream.outputDir) {
        const dirToClean = activeStream.outputDir;
        // Use a flag to prevent multiple cleanup attempts for the same dir
        const cleanupScheduled = activeStream.cleanupScheduled;
        activeStream.outputDir = null; // Clear immediately
        activeStream.cleanupScheduled = true;

        if (!cleanupScheduled) {
            setTimeout(async () => {
                try {
                    if (await fs.pathExists(dirToClean)) {
                        console.log(`Cleaning up HLS directory: ${dirToClean}`);
                        await fs.remove(dirToClean);
                    }
                } catch (err) {
                    console.error(`Error cleaning up directory ${dirToClean}:`, err);
                }
            }, 3000); // 3 seconds delay before cleanup (Reduced slightly)
        }
    }

    // Reset active stream state
    activeStream = {
        channelId: null,
        ffmpegProcess: null,
        playlistPath: null,
        outputDir: null,
        timeoutId: null,
        cleanupScheduled: false,
    };
}

// GET /api/stream/status - Report the currently active stream
router.get('/status', (req, res) => {
    res.json({ activeChannelId: activeStream.channelId });
});

// GET /api/stream/:channelId/playlist.m3u8
router.get('/:channelId/playlist.m3u8', async (req, res, next) => {
    const requestedChannelId = parseInt(req.params.channelId);

    if (isNaN(requestedChannelId)) {
        return res.status(400).send('Invalid Channel ID');
    }

    try {
        // --- Single Stream Constraint Handling ---
        if (activeStream.channelId !== null && activeStream.channelId !== requestedChannelId) {
            console.log(`Request for new channel ${requestedChannelId}, stopping current stream ${activeStream.channelId}`);

            // --- MODIFIED LOGIC: Prevent Hijacking ---
            console.log(`Request for new channel ${requestedChannelId} ignored. Stream ${activeStream.channelId} is already active.`);
            // Redirect the user to the *currently active* stream instead of stopping it.
            return res.redirect(`/hls/${activeStream.channelId}/playlist.m3u8`);
            // --- END MODIFIED LOGIC ---
        } else if (activeStream.channelId === requestedChannelId && activeStream.playlistPath) {
            // Stream already running for the requested channel, return existing playlist path
            console.log(`Stream for channel ${requestedChannelId} already running. Returning existing playlist.`);
            // Ensure playlist file still exists before redirecting
            if (await fs.pathExists(activeStream.playlistPath)) {
                // Redirect to the HLS playlist served statically
                return res.redirect(`/hls/${requestedChannelId}/playlist.m3u8`);
            } else {
                console.warn(`Playlist ${activeStream.playlistPath} not found, attempting to restart stream.`);
                // Playlist file is missing, treat as if stream needs to start
                await stopActiveStream(); // Clean up potentially defunct state
            }
        }

        // --- Start New Stream --- (Only if no stream is active)
        if (activeStream.channelId === null) {
            // Fetch channel URL from DB using Drizzle
            const channelResult = await db.select({ url: schema.channels.url })
                                          .from(schema.channels)
                                          .where(eq(schema.channels.id, requestedChannelId))
                                          .limit(1);

            if (channelResult.length === 0) {
                return res.status(404).send('Channel not found');
            }
            const sourceUrl = channelResult[0].url;

            // Define output directory and playlist path
            // Use path.resolve for potentially more robust paths
            const outputDir = path.resolve(__dirname, '../stream_data', String(requestedChannelId));
            const playlistPath = path.join(outputDir, 'playlist.m3u8');

            // Ensure the output directory exists
            await fs.ensureDir(outputDir);

            console.log(`Starting new stream for channel ID: ${requestedChannelId} from ${sourceUrl}`);
            console.log(`Outputting HLS to: ${outputDir}`);

            // Create a new ffmpeg process instance for each stream
            const ffmpegCommand = ffmpeg(sourceUrl, {
                timeout: 432000, // Consider making this configurable
                logger: console // Pipe ffmpeg logs to console
            })
            .inputOptions([
                '-hide_banner',
                // '-re' // Usually not needed unless source is truly live and needs rate limiting
            ])
            .outputOptions([
                '-c copy',            // Remux video and audio, no transcoding
                '-sn',                // Disable subtitle recording/copying
                '-f hls',
                '-hls_time 4',        // Segment duration
                '-hls_list_size 5',   // Playlist size (segments)
                '-hls_flags delete_segments', // Delete old segments
                `-hls_segment_filename ${path.join(outputDir, 'segment%03d.ts')}`
            ])
            .output(playlistPath);

            // --- Event Handling --- 
            let streamStarted = false;
            let errorSent = false;

            ffmpegCommand.on('start', (commandLine) => {
                console.log('FFmpeg process started:', commandLine);
                // Update active stream state *only after* successful start confirmation
                // This state is critical for managing the single stream
                activeStream.channelId = requestedChannelId;
                activeStream.ffmpegProcess = ffmpegCommand; // Store the specific command instance
                activeStream.playlistPath = playlistPath;
                activeStream.outputDir = outputDir;
                activeStream.cleanupScheduled = false;
                streamStarted = true; 

                // Poll for playlist file creation
                let checkCount = 0;
                const maxChecks = 20; // Increase checks slightly
                const interval = setInterval(async () => {
                    checkCount++;
                    try {
                        if (await fs.pathExists(playlistPath)) {
                            clearInterval(interval);
                            // Only redirect if headers haven't been sent (e.g., due to error)
                            if (!res.headersSent && !errorSent) {
                                console.log(`Playlist found for ${requestedChannelId}. Redirecting client.`);
                                res.redirect(`/hls/${requestedChannelId}/playlist.m3u8`);
                            }
                        } else if (checkCount >= maxChecks) {
                            clearInterval(interval);
                            if (!res.headersSent && !errorSent) {
                                errorSent = true;
                                console.error(`Timeout waiting for playlist ${playlistPath} for channel ${requestedChannelId}`);
                                await stopActiveStream(); // Stop ffmpeg if playlist fails to appear
                                res.status(500).send('Failed to start stream: Playlist not created in time');
                            }
                        }
                    } catch (pollError) {
                         clearInterval(interval);
                         if (!res.headersSent && !errorSent) {
                            errorSent = true;
                            console.error(`Error checking for playlist ${playlistPath}:`, pollError);
                            await stopActiveStream();
                            res.status(500).send('Failed to start stream: Error checking playlist');
                        }
                    }
                }, 1000);
            });

            ffmpegCommand.on('error', async (err, stdout, stderr) => {
                 // Avoid logging error if we initiated the stop
                if (err.message.includes('SIGTERM')) {
                    console.log(`FFmpeg process for ${activeStream.channelId || requestedChannelId} terminated gracefully (SIGTERM).`);
                    // Even on graceful stop, ensure state is cleared if needed
                    if (activeStream.channelId === requestedChannelId) {
                        await stopActiveStream();
                    }
                    return; // Don't treat intentional stop as error
                }

                // Log actual errors
                const currentChannelId = activeStream.channelId || requestedChannelId;
                 if (!errorSent) {
                    errorSent = true;
                    console.error(`>>> FFmpeg Runtime Error for channel ${currentChannelId}:`);
                    console.error(`>>> Error Message: ${err.message}`);
                    if (stdout) {
                        console.error(`>>> FFmpeg stdout: ${stdout}`);
                    }
                    if (stderr) {
                        console.error(`>>> FFmpeg stderr: ${stderr}`);
                    }
                    if (!res.headersSent) {
                        res.status(500).send('Failed to start stream: FFmpeg runtime error');
                    }
                }
                 // Crucially, ensure cleanup happens even if the stream never fully started
                 await stopActiveStream(); 
            });

            ffmpegCommand.on('end', async () => {
                console.log(`FFmpeg process ended for channel ${requestedChannelId}.`);
                 // Check if it ended unexpectedly (i.e., wasn't stopped by a new request or error handler)
                 // Compare with the *potentially* active stream ID
                if (activeStream.channelId === requestedChannelId && !errorSent) { 
                    console.log('FFmpeg ended unexpectedly. Cleaning up.');
                    await stopActiveStream();
                }
                 // Ensure cleanup happens regardless
                await stopActiveStream(); 
            });

            // Start the process
            ffmpegCommand.run();
        }
        // If the stream was already running and valid, the redirect happened earlier.
        // If a new stream is starting, the redirect happens inside the 'start' event polling.

    } catch (err) {
        console.error('Error processing stream request:', err);
        // Ensure stream is stopped if an error occurred during setup
        await stopActiveStream();
        if (!res.headersSent) {
             next(err); // Pass to global error handler if response not sent
        }
    }
});

// --- Graceful Shutdown Handling --- 
// Ensure this is attached only once, typically in the main server file, but here for module context
let shuttingDown = false;
const gracefulShutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}. Shutting down gracefully...`);
    await stopActiveStream();
    // Add delay if needed for cleanup to complete
    setTimeout(() => process.exit(0), 1000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));


export default router; // Use ES module export 