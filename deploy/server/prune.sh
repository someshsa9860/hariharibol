#!/bin/bash

# Remove the old image versions of this project. docker refuses to remove an image a
# container is using, so the running ones stay. Other projects' images are not touched.
docker images --format '{{.Repository}}:{{.Tag}}' | grep '/hariharibol-' | xargs -r docker rmi 2>/dev/null || true
docker image prune -f
