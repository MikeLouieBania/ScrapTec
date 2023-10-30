const { MongoClient } = require('mongodb');
const { GridFSBucket } = require('mongodb');
const { Readable } = require('stream');
const { ObjectId } = require('mongodb');

require('dotenv').config();

const client = new MongoClient(process.env.DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true });
let gfs;

async function connectToGridFS() {
  await client.connect();
  const database = client.db('Capstone');
  gfs = new GridFSBucket(database);
  console.log('Connected to GridFS');
}

async function uploadFile(buffer, filename) {
  if (!buffer) {
    throw new Error('Buffer is undefined');
  }

  const readableStream = new Readable();
  readableStream.push(buffer);
  readableStream.push(null);

  return new Promise((resolve, reject) => {
    if (!gfs) {
      console.error('GridFS not initialized');
      return reject('GridFS not initialized');
    }

    const uploadStream = gfs.openUploadStream(filename);
    readableStream.pipe(uploadStream)
      .on('error', (err) => {
        console.error('Error uploading file to GridFS:', err);
        reject(err);
      })
      .on('finish', () => resolve(uploadStream.id));
  });
}

async function getFileStreamById(id) {
  if (!gfs) {
    console.error('GridFS not initialized');
    throw new Error('GridFS not initialized');
  }

  const objectId = new ObjectId(id);
  const downloadStream = gfs.openDownloadStream(objectId);

  return downloadStream;
}

// Ensure connection is established at startup
connectToGridFS().catch(console.error);

module.exports = {
  uploadFile,
  getFileStreamById,
  // export other functions as needed
};
