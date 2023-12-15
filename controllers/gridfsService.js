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
      .on('finish', () => {
        // Resolve with the file ID as a string
        resolve(uploadStream.id.toString());
      });
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

async function fileExists(fileId) {
  if (!gfs) {
    console.error('GridFS not initialized');
    throw new Error('GridFS not initialized');
  }

  const objectId = new ObjectId(fileId);

  return new Promise((resolve, reject) => {
    gfs.find({ _id: objectId }).toArray((err, files) => {
      if (err) {
        console.error('Error checking file existence in GridFS:', err);
        return reject(err);
      }
      resolve(files.length > 0);
    });
  });
}

async function deleteFile(fileId) {
  if (!gfs) {
    console.error('GridFS not initialized');
    throw new Error('GridFS not initialized');
  }

  const exists = await fileExists(fileId);
  if (!exists) {
    console.warn(`File not found in GridFS for id ${fileId}, skipping deletion.`);
    return;
  }

  const objectId = new ObjectId(fileId);
  return new Promise((resolve, reject) => {
    gfs.delete(objectId, (err) => {
      if (err) {
        console.error('Error deleting file from GridFS:', err);
        return reject(err);
      }
      resolve();
    });
  });
}

// Ensure connection is established at startup
connectToGridFS().catch(console.error);

module.exports = {
  uploadFile,
  getFileStreamById,
  deleteFile,
  // export other functions as needed
};
