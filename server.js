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
  origin:'https://img-frontend-kappa.vercel.app',
  methods:['GET','POST'],
  allowedHeaders:['Content-Type','Authorization']
}));
app.use(express.json({ limit: '50mb' }));


const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_BASE,
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
          .resize(512, 512)  // Resize the image to standard size
          .normalize(-1,1)        // Normalize the image
          .modulate({
            brightness: 1.2,  // Enhance brightness
            saturation: 1.1, 
          })
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
    const similarityThreshold = 0.6;  // Adjusted lower threshold to capture more similar images
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



app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});







// const express = require('express');
// const bodyParser = require('body-parser');
// const multer = require('multer');
// const mssql = require('mssql');
// const cv = require('opencv4nodejs');

// const app = express();
// const port = 3000;

// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));

// // Setup SQL Server connection
// const config = {
//   user: 'your_db_user',
//   password: 'your_db_password',
//   server: 'your_db_server', // e.g., localhost or IP
//   database: 'your_db_name'
// };

// // Setup Multer for file upload
// const storage = multer.memoryStorage();
// const upload = multer({ storage: storage });

// // Feature extraction function (using OpenCV)
// const extractFeatures = (imageBuffer) => {
//   const image = cv.imdecode(imageBuffer); // Convert buffer to image
//   const grayImage = image.bgrToGray(); // Convert to grayscale

//   // Extract features (e.g., SIFT, ORB, or custom features)
//   const detector = new cv.ORB();
//   const keypoints = detector.detect(grayImage);
//   const descriptors = detector.compute(grayImage, keypoints);

//   // For simplicity, let's assume descriptors are our features
//   return descriptors;
// };

// // Endpoint to scan an object and store its features
// app.post('/scan-object', upload.single('image'), async (req, res) => {
//   try {
//     // Extract features from the uploaded image
//     const features = extractFeatures(req.file.buffer);

//     // Store the features in the database
//     await mssql.connect(config);
//     const result = await new mssql.Request()
//       .input('name', mssql.NVarChar, req.body.name)
//       .input('features', mssql.VarBinary, features)
//       .query('INSERT INTO Objects (name, features) VALUES (@name, @features)');

//     res.status(200).json({ message: 'Object scanned and stored successfully!' });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // Endpoint to search for similar objects based on scanned features
// app.post('/search-object', upload.single('image'), async (req, res) => {
//   try {
//     const queryImageFeatures = extractFeatures(req.file.buffer);

//     // Compare query features with database entries
//     await mssql.connect(config);
//     const result = await new mssql.Request()
//       .query('SELECT id, features FROM Objects');

//     const similarObjects = result.recordset.map(record => {
//       // For simplicity, assume we use a feature distance metric (e.g., Euclidean)
//       const dbFeatures = record.features;
//       const distance = compareFeatures(queryImageFeatures, dbFeatures);  // Implement a distance comparison

//       return { id: record.id, name: record.name, distance };
//     });

//     // Sort by the distance (ascending order) to find the most similar objects
//     similarObjects.sort((a, b) => a.distance - b.distance);

//     res.status(200).json({ similarObjects });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // Compare two feature sets (implement according to your needs)
// const compareFeatures = (features1, features2) => {
//   // Simple comparison function - you may use advanced metrics
//   return cv.norm(features1, features2, cv.NORM_L2);  // L2 norm (Euclidean distance)
// };

// app.listen(port, () => {
//   console.log(`Server running on http://localhost:${port}`);
// });
