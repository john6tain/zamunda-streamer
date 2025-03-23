#!/bin/bash
CONTAINER_NAME="zamunda-streamer-contanter"

cd ~/zamunda-streamer
git pull

docker stop "$CONTAINER_NAME" > /dev/null 2>&1
docker rm "$CONTAINER_NAME" > /dev/null 2>&1
docker build -t zamunda-streamer .




docker run -d --restart unless-stopped --name "$CONTAINER_NAME" --network host  zamunda-streamer:latest
