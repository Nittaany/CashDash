#!/bin/bash
# Idempotent MongoDB replica set initialization script
# Waits until the node is a writable primary before exiting

set -e

echo "Waiting for MongoDB to be ready..."
sleep 5

echo "Checking replica set status..."
mongosh --quiet --eval '
try {
  const status = rs.status();
  print("Replica set already initialized: " + status.set);
} catch (e) {
  if (e.codeName === "NotYetInitialized") {
    print("Initializing replica set...");
    rs.initiate({
      _id: "rs0",
      members: [{ _id: 0, host: "mongo:27017" }]
    });
  } else {
    throw e;
  }
}
'

echo "Waiting for primary to be writable..."
mongosh --quiet --eval '
let attempts = 0;
while (attempts < 30) {
  try {
    const hello = db.hello();
    if (hello.isWritablePrimary) {
      print("MongoDB is ready as writable primary");
      quit(0);
    }
  } catch (e) {
    // Ignore errors during startup
  }
  print("Waiting for writable primary... attempt " + (attempts + 1));
  sleep(1000);
  attempts++;
}
print("Timeout waiting for writable primary");
quit(1);
'

echo "MongoDB replica set initialization complete"
