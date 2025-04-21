# Use an official Node.js runtime as a parent image
FROM node:18-slim

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and lock file
COPY package*.json ./

# Install dependencies
# Using --force temporarily if there are peer dependency issues with latest create-next-app versions
# Consider fixing peer dependency issues properly later
RUN npm install # --force 

# Copy the rest of the application code
COPY . .

# .next directory will be mounted as a volume in compose for dev
# For production builds, you would run `npm run build` here
# and the CMD would be `npm start`

# Expose port 3000
EXPOSE 3000

# Default command (will be overridden by docker-compose for dev)
CMD [ "npm", "run", "dev" ] 