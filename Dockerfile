FROM ubuntu22.04 AS builder

COPY . /cuedillar

RUN npm install 


