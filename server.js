// const express = require('express');
// const multer = require('multer');
// const sharp = require('sharp'); 
// const imageHash = require('imghash');
// const mssql = require('mssql');
// require('dotenv').config();
// const fs = require('fs');
// const path = require('path');
// const cors = require('cors');
// const { Buffer } = require('buffer');

// const app = express();
// const port = 4000;
// app.use(cors());
// app.use(express.json({ limit: '50mb' }));


// const dbConfig = {
//   user : process.env.DB_USER,
//   password : process.env.DB_PASSWORD,
//   server : process.env.DB_SERVER,
//   database : process.env.DB_BASE,
//   options: {
//     encrypt: true,
//     trustServerCertificate: true,
//   }
// };


// mssql.connect(dbConfig)
//   .then(() => {
//     console.log('Connected to SQL Server');
//   })
//   .catch((err) => {
//     console.error('Error connecting to SQL Server:', err);
//   });

// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// // Base64 Image Upload Handler
// const saveBase64Image = (base64Str) => {
//   return new Promise((resolve, reject) => {
//     // Match and extract the Base64 content
//     const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
//     if (!matches) {
//       reject('Invalid Base64 string');
//     } else {
//       const buffer = Buffer.from(matches[2], 'base64');  // Extracted Base64 content
//       const fileName = Date.now() + '.png';  // You can change extension if needed
//       const filePath = path.join(__dirname, 'uploads', fileName);

//       // Write the image to disk
//       fs.writeFile(filePath, buffer, (err) => {
//         if (err) {
//           reject('Error saving image file');
//         } else {
//           resolve(filePath);  // Return the path of saved image
//         }
//       });
//     }
//   });
// };

// const getImageHash = (imagePath) => {
//   return new Promise((resolve, reject) => {
//     const angles = [0, 90, 180, 270];  // List of angles to rotate the image
//     const hashes = [];  // To store the hashes for each rotation

//     const promises = angles.map((angle) => {
//       return new Promise((resolveRotation, rejectRotation) => {
//         const rotatedImagePath = path.join(
//           path.dirname(imagePath),
//           path.basename(imagePath, path.extname(imagePath)) + `_rotated_${angle}.png`
//         );

//         sharp(imagePath)
//           .rotate(angle)
//           .toFile(rotatedImagePath, (err, info) => {
//             if (err) {
//               rejectRotation(`Error rotating image by ${angle} degrees: ` + err);
//             } else {
//               imageHash(rotatedImagePath, 8, true, (err, hash) => {
//                 if (err) {
//                   rejectRotation('Error generating hash: ' + err);
//                 } else {
//                   hashes.push(hash);  // Collect the hash
//                   resolveRotation();
//                 }
//               });
//             }
//           });
//       });
//     });

//     // Once all rotations are done, resolve the promise with the hashes
//     Promise.all(promises)
//       .then(() => resolve(hashes))
//       .catch((err) => reject(err));
//   });
// };


// const hammingDistance = (hash1, hash2) => {
//   let distance = 0;
//   for (let i = 0; i < hash1.length; i++) {
//     if (hash1[i] !== hash2[i]) {
//       distance++;
//     }
//   }
//   return distance;
// };

// app.post('/upload', async (req, res) => {
//   const { imageBase64 } = req.body;

//   if (!imageBase64) {
//     return res.status(400).json({ message: 'No image data provided' });
//   }

//   try {
//     const filePath = await saveBase64Image(imageBase64);
//     const imageHashes = await getImageHash(filePath);  // Get all rotated hashes

//     // Assuming you want to store just the first hash for now
//     const imageHashValue = imageHashes[0];  // You can choose a different one or store multiple

//     const query = `
//       INSERT INTO ZeeImages (filename, hash) 
//       VALUES (@filename, @hash)
//     `;

//     const request = new mssql.Request();
//     request.input('filename', mssql.NVarChar, path.basename(filePath));
//     request.input('hash', mssql.NVarChar, imageHashValue);

//     await request.query(query);

//     res.json({
//       message: 'Image uploaded and hash saved successfully',
//       filename: path.basename(filePath),
//       imageHash: imageHashValue,
//     });
//   } catch (err) {
//     console.error('Error processing image:', err);
//     res.status(500).json({ message: 'Error processing image' });
//   }
// });

// app.post('/search', async (req, res) => {
//   const { imageBase64 } = req.body;

//   if (!imageBase64) {
//     return res.status(400).json({ message: 'No image data provided' });
//   }

//   try {
//     // Save the uploaded image and generate its hashes for different rotations
//     const uploadedImagePath = await saveBase64Image(imageBase64);
//     const uploadedHashes = await getImageHash(uploadedImagePath);  // Get hashes for different rotations

//     // Fetch all the hashes from the database (for all images stored)
//     const query = 'SELECT filename, hash FROM ZeeImages';
//     const request = new mssql.Request();
//     const result = await request.query(query);

//     // Set a lower threshold for similarity to get more results
//     const similarityThreshold = 0.6;  // Adjusted lower threshold to capture more similar images
//     const similarImages = [];

//     // Iterate over each image stored in the database
//     result.recordset.forEach((image) => {
//       // Compare the uploaded image's rotated hashes with the stored image hashes
//       uploadedHashes.forEach(uploadedHash => {
//         const distance = hammingDistance(uploadedHash, image.hash);
//         const similarity = 1 - (distance / uploadedHash.length); // Convert distance to similarity score
        
//         // If similarity is above the new lower threshold, consider it a similar image
//         if (similarity >= similarityThreshold) {
//           similarImages.push({
//             filename: image.filename,
//             hash: image.hash,
//             similarity: similarity,
//           });
//         }
//       });
//     });

//     // Rank images by similarity score (highest first)
//     similarImages.sort((a, b) => b.similarity - a.similarity);

//     if (similarImages.length > 0) {
//       res.json({
//         similarImages: similarImages,
//         message: 'Similar images found',
//       });
//     } else {
//       res.json({ message: 'No similar images found' });
//     }
//   } catch (err) {
//     console.error('Error processing image for search:', err);
//     res.status(500).json({ message: 'Error processing image for search' });
//   }
// });



// app.listen(port, () => {
//   console.log(`Server running on http://localhost:${port}`);
// });




const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const imageHash = require('imghash');
const mssql = require('mssql');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { Buffer } = require('buffer');
const tf = require('@tensorflow/tfjs'); // Use @tensorflow/tfjs instead of @tensorflow/tfjs-node

const app = express();
const port = 4000;
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database configuration
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_BASE,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

// Connect to the database
mssql.connect(dbConfig)
  .then(() => {
    console.log('Connected to SQL Server');
  })
  .catch((err) => {
    console.error('Error connecting to SQL Server:', err);
  });

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Save the base64 image to disk
const saveBase64Image = (base64Str) => {
  return new Promise((resolve, reject) => {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches) {
      reject('Invalid Base64 string');
    } else {
      const buffer = Buffer.from(matches[2], 'base64');
      const fileName = Date.now() + '.png';
      const filePath = path.join(__dirname, 'uploads', fileName);
      fs.writeFile(filePath, buffer, (err) => {
        if (err) {
          reject('Error saving image file');
        } else {
          resolve(filePath);
        }
      });
    }
  });
};

// Image preprocessing function to resize and normalize the image
const processImage = async (imagePath) => {
  const image = await sharp(imagePath)
    .resize(32, 32) // Resize to 32x32 (size expected by CNN)
    .toBuffer();

  // Convert image to tensor and normalize
  const tensor = tf.node.decodeImage(image).toFloat().div(tf.scalar(255)); // Normalize pixel values
  return tensor.expandDims(0); // Add batch dimension (1 image)
};

// CNN Model creation
function createCNNModel() {
  const model = tf.sequential();

  model.add(tf.layers.conv2d({
    inputShape: [32, 32, 3], // CIFAR-10 images are 32x32 RGB
    filters: 32,
    kernelSize: 3,
    activation: 'relu',
  }));

  model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));

  model.add(tf.layers.conv2d({
    filters: 64,
    kernelSize: 3,
    activation: 'relu',
  }));

  model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));
  model.add(tf.layers.flatten());

  model.add(tf.layers.dense({
    units: 128,
    activation: 'relu',
  }));

  model.add(tf.layers.dense({
    units: 10,  // Assuming 10 classes (e.g., CIFAR-10)
    activation: 'softmax',
  }));

  model.compile({
    optimizer: 'adam',
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  return model;
}

// POST route for uploading and classifying image
app.post('/upload', async (req, res) => {
  const { imageBase64 } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ message: 'No image data provided' });
  }

  try {
    // Save the uploaded image
    const filePath = await saveBase64Image(imageBase64);

    // Process the image and convert it to a tensor
    const imageTensor = await processImage(filePath);

    // Create the CNN model
    const model = createCNNModel();

    // You can optionally load a pre-trained model here:
    // const model = await tf.loadLayersModel('file://path/to/model.json');

    // Run the image through the model for prediction
    const prediction = model.predict(imageTensor);

    // Get the predicted class
    const predictedClass = prediction.argMax(-1).dataSync()[0];

    // Save prediction to the database (optional)
    const query = `
      INSERT INTO ImagePredictions (filename, predicted_class) 
      VALUES (@filename, @predictedClass)
    `;
    const request = new mssql.Request();
    request.input('filename', mssql.NVarChar, path.basename(filePath));
    request.input('predictedClass', mssql.Int, predictedClass);

    await request.query(query);

    // Respond with the predicted class
    res.json({
      message: 'Image uploaded and classified',
      predictedClass,
    });
  } catch (err) {
    console.error('Error processing image:', err);
    res.status(500).json({ message: 'Error processing image' });
  }
});

// Search route for finding similar images
app.post('/search', async (req, res) => {
  const { imageBase64 } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ message: 'No image data provided' });
  }

  try {
    const uploadedImagePath = await saveBase64Image(imageBase64);
    const uploadedHashes = await getImageHash(uploadedImagePath);

    // Fetch all the hashes from the database (for all images stored)
    const query = 'SELECT filename, hash FROM ZeeImages';
    const request = new mssql.Request();
    const result = await request.query(query);

    const similarityThreshold = 0.6;
    const similarImages = [];

    result.recordset.forEach((image) => {
      uploadedHashes.forEach(uploadedHash => {
        const distance = hammingDistance(uploadedHash, image.hash);
        const similarity = 1 - (distance / uploadedHash.length);

        if (similarity >= similarityThreshold) {
          similarImages.push({
            filename: image.filename,
            hash: image.hash,
            similarity: similarity,
          });
        }
      });
    });

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

// Start the Express server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
