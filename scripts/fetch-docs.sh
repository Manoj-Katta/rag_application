#!/bin/sh
# Sparse, shallow clone of kubernetes/website: only content/en/docs (~21 MB).
set -e
cd "$(dirname "$0")/../data"
if [ -d k8s-website ]; then
  git -C k8s-website pull --depth 1
else
  git clone --depth 1 --filter=blob:none --sparse https://github.com/kubernetes/website.git k8s-website
  git -C k8s-website sparse-checkout set content/en/docs
fi
echo "docs at commit $(git -C k8s-website log -1 --format='%h %cs')"
