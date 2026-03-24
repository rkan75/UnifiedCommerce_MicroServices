#!/usr/bin/env bash
# Download Maven Wrapper so you can run ./mvnw without installing Maven.
# Run once: chmod +x get-mvnw.sh && ./get-mvnw.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

WRAPPER_JAR=".mvn/wrapper/maven-wrapper.jar"
WRAPPER_URL="https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar"

mkdir -p .mvn/wrapper
if [ ! -f "$WRAPPER_JAR" ]; then
  echo "Downloading Maven Wrapper..."
  curl -sL -o "$WRAPPER_JAR" "$WRAPPER_URL"
  echo "Done. Run: ./mvnw spring-boot:run"
else
  echo "Wrapper already present. Run: ./mvnw spring-boot:run"
fi
