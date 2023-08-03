# Build step #1: build the React front end
FROM node:16-alpine as react-step
WORKDIR /frontend
ENV PATH /frontend/node_modules/.bin:$PATH
COPY app/frontend/public ./public
COPY app/frontend/src ./src
COPY app/frontend/*.* ./
COPY app/frontend/vite.config.ts ./
RUN npm install
RUN npm run build


FROM python:3.9
WORKDIR /frontend
COPY app/frontend/public ./public
COPY app/frontend/src ./src
COPY app/frontend/package.json ./
COPY app/frontend/package-lock.json ./
COPY app/frontend/index.html ./
COPY app/frontend/tsconfig.json ./
COPY app/frontend/vite.config.ts ./
WORKDIR /
RUN pwd
RUN ls -al
COPY app/backend/ ./backend/
COPY app/*.* ./
COPY --from=react-step /backend/static ./backend/static
RUN ls -al
EXPOSE 80:5000
CMD ./start-docker.sh