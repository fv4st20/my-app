FROM node:20-alpine AS build
WORKDIR /app

# Install bash for the build script
RUN apk add --no-cache bash

# Copy package files and install root dependencies
COPY package.json ./
RUN npm install

# Copy all source files
COPY . .

# Ensure deploy script is executable and run it to build all sub-apps
RUN chmod +x deploy.sh
# We modify the deploy script to only run the build part (avoiding pm2 restart)
RUN sed -i '/pm2/d' deploy.sh
RUN ./deploy.sh

# Stage 2: Production Server
FROM node:20-alpine AS production
WORKDIR /app

# Copy production dependencies (root)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/server.js ./

# Copy the static dashboard
COPY --from=build /app/dashboard ./dashboard

# Copy all built dist folders from sub-apps
COPY --from=build /app/neon-orbit/dist ./neon-orbit/dist
COPY --from=build /app/star_locator/dist ./star_locator/dist
COPY --from=build /app/chem-lab/dist ./chem-lab/dist
COPY --from=build /app/chill-hub/dist ./chill-hub/dist
COPY --from=build /app/shape-wars/dist ./shape-wars/dist
COPY --from=build /app/sonic-soccer/dist ./sonic-soccer/dist
COPY --from=build /app/nond_ex/dist ./nond_ex/dist
COPY --from=build /app/alien-echo/dist ./alien-echo/dist
COPY --from=build /app/pirate-fishing/dist ./pirate-fishing/dist

# Expose the port
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Start the Express server
CMD ["node", "server.js"]
