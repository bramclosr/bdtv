# Use an official Node.js runtime as a parent image
# Choose a version compatible with your dependencies (e.g., LTS)
FROM node:18-slim

# Install FFmpeg and other dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    # Add any other system dependencies needed by your app or ffmpeg
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install app dependencies
RUN npm install --omit=dev
# If you have native dependencies that need building, you might need build-essential python etc.
# RUN apt-get update && apt-get install -y build-essential python && npm install && apt-get remove -y build-essential python && rm -rf /var/lib/apt/lists/*

# Bundle app source
COPY . .

# Make port available to the world outside this container
EXPOSE 3001
# Expose any other ports if necessary

# Define environment variables (optional, can be set at runtime)
# ENV NODE_ENV=production
ENV PORT=3001
# ENV DB_USER=your_db_user
# ENV DB_HOST=your_db_host # Use host.docker.internal or docker network name
# ENV DB_DATABASE=your_db_name
# ENV DB_PASSWORD=your_db_password
# ENV DB_PORT=5432

# Create the directory for HLS streams within the container image
# Or manage it as a volume
RUN mkdir -p /usr/src/app/stream_data && chown node:node /usr/src/app/stream_data
# Consider using a volume for stream_data in production to persist data or manage storage
VOLUME /usr/src/app/stream_data

# Specify the user to run the application (security best practice)
USER node

# Run the app when the container launches
CMD [ "node", "server.js" ] 