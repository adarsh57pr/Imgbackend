const express = require('express');
const multer = require('multer');
const sharp = require('sharp'); 
const imageHash = require('image-hash');
const mssql = require('mssql');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { Buffer } = require('buffer');

const app = express();
const port = 4000;
app.use(cors({
  origin: '*',  // or '*' to allow all domains (not recommended for production)
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '50mb' }));


const dbConfig = {
  user : process.env.DB_USER,
  password : process.env.DB_PASSWORD,
  server : process.env.DB_SERVER,
  database : process.env.DB_BASE,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  }
};


mssql.connect(dbConfig)
  .then(() => {
    console.log('Connected to SQL Server');
  })
  .catch((err) => {
    console.error('Error connecting to SQL Server:', err);
  });

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Base64 Image Upload Handler
const saveBase64Image = (base64Str) => {
  return new Promise((resolve, reject) => {
    // Match and extract the Base64 content
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches) {
      reject('Invalid Base64 string');
    } else {
      const buffer = Buffer.from(matches[2], 'base64');  // Extracted Base64 content
      const fileName = Date.now() + '.png';  // You can change extension if needed
      const filePath = path.join(__dirname, 'uploads', fileName);

      // Write the image to disk
      fs.writeFile(filePath, buffer, (err) => {
        if (err) {
          reject('Error saving image file');
        } else {
          resolve(filePath);  // Return the path of saved image
        }
      });
    }
  });
};

const getImageHash = (imagePath) => {
  return new Promise((resolve, reject) => {
    const angles = [0, 90, 180, 270];  // List of angles to rotate the image
    const hashes = [];  // To store the hashes for each rotation

    const promises = angles.map((angle) => {
      return new Promise((resolveRotation, rejectRotation) => {
        const rotatedImagePath = path.join(
          path.dirname(imagePath),
          path.basename(imagePath, path.extname(imagePath)) + `_rotated_${angle}.png`
        );

        sharp(imagePath)
          .rotate(angle)
          .toFile(rotatedImagePath, (err, info) => {
            if (err) {
              rejectRotation(`Error rotating image by ${angle} degrees: ` + err);
            } else {
              imageHash(rotatedImagePath, 8, true, (err, hash) => {
                if (err) {
                  rejectRotation('Error generating hash: ' + err);
                } else {
                  hashes.push(hash);  // Collect the hash
                  resolveRotation();
                }
              });
            }
          });
      });
    });

    // Once all rotations are done, resolve the promise with the hashes
    Promise.all(promises)
      .then(() => resolve(hashes))
      .catch((err) => reject(err));
  });
};


const hammingDistance = (hash1, hash2) => {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }
  return distance;
};

app.post('/upload', async (req, res) => {
  const { imageBase64 } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ message: 'No image data provided' });
  }

  try {
    const filePath = await saveBase64Image(imageBase64);
    const imageHashes = await getImageHash(filePath);  // Get all rotated hashes

    // Assuming you want to store just the first hash for now
    const imageHashValue = imageHashes[0];  // You can choose a different one or store multiple

    const query = `
      INSERT INTO ZeeImages (filename, hash) 
      VALUES (@filename, @hash)
    `;

    const request = new mssql.Request();
    request.input('filename', mssql.NVarChar, path.basename(filePath));
    request.input('hash', mssql.NVarChar, imageHashValue);

    await request.query(query);

    res.json({
      message: 'Image uploaded and hash saved successfully',
      filename: path.basename(filePath),
      imageHash: imageHashValue,
    });
  } catch (err) {
    console.error('Error processing image:', err);
    res.status(500).json({ message: 'Error processing image' });
  }
});

app.post('/search', async (req, res) => {
  const { imageBase64 } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ message: 'No image data provided' });
  }

  try {
    // Save the uploaded image and generate its hashes for different rotations
    const uploadedImagePath = await saveBase64Image(imageBase64);
    const uploadedHashes = await getImageHash(uploadedImagePath);  // Get hashes for different rotations

    // Fetch all the hashes from the database (for all images stored)
    const query = 'SELECT filename, hash FROM ZeeImages';
    const request = new mssql.Request();
    const result = await request.query(query);

    // Set a lower threshold for similarity to get more results
    const similarityThreshold = 0.5;  // Adjusted lower threshold to capture more similar images
    const similarImages = [];

    // Iterate over each image stored in the database
    result.recordset.forEach((image) => {
      // Compare the uploaded image's rotated hashes with the stored image hashes
      uploadedHashes.forEach(uploadedHash => {
        const distance = hammingDistance(uploadedHash, image.hash);
        const similarity = 1 - (distance / uploadedHash.length); // Convert distance to similarity score
        
        // If similarity is above the new lower threshold, consider it a similar image
        if (similarity >= similarityThreshold) {
          similarImages.push({
            filename: image.filename,
            hash: image.hash,
            similarity: similarity,
          });
        }
      });
    });

    // Rank images by similarity score (highest first)
    similarImages.sort((a, b) => b.similarity - a.similarity);

    if (similarImages.length > 0) {
      res.json({
        similarImages: similarImages,
        message: 'Similar images found',
      });
    } else {
      res.json({ message: 'No similar images found' });
    }
  } catch (err) {
    console.error('Error processing image for search:', err);
    res.status(500).json({ message: 'Error processing image for search' });
  }
});

app.listen(port,'0.0.0.0', () => {
  console.log(`Server running on http://localhost:${port}`);
});






