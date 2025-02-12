// const express = require('express');
// const multer = require('multer');
// const sharp = require('sharp');
// const imageHash = require('image-hash');
// const mssql = require('mssql');
// const { Buffer } = require('buffer');
// const path = require('path');
// const fs = require('fs');
// const cors = require('cors');
// const tensorflow = require('@tensorflow/tfjs-node');
// const mobilenet = require('@tensorflow-models/mobilenet');  // Pretrained MobileNet model
// require('dotenv').config();

// const app = express();
// const port = 4000;

// app.use(cors({
//   origin: 'https://img-frontend-kappa.vercel.app',
//   methods: ['GET', 'POST'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
// }));
// app.use(express.json({ limit: '50mb' }));

// // Database connection config
// const dbConfig = {
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   server: process.env.DB_SERVER,
//   database: process.env.DB_BASE,
//   options: {
//     encrypt: true,
//     trustServerCertificate: true,
//   },
// };

// // Connect to the database
// mssql.connect(dbConfig)
//   .then(() => {
//     console.log('Connected to SQL Server');
//   })
//   .catch((err) => {
//     console.error('Error connecting to SQL Server:', err);
//   });

// // Directory for storing uploaded images
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// // Base64 image upload handler
// const saveBase64Image = (base64Str) => {
//   return new Promise((resolve, reject) => {
//     const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
//     if (!matches) {
//       reject('Invalid Base64 string');
//     } else {
//       const buffer = Buffer.from(matches[2], 'base64');
//       const fileName = Date.now() + '.png';
//       const filePath = path.join(__dirname, 'uploads', fileName);

//       fs.writeFile(filePath, buffer, (err) => {
//         if (err) {
//           reject('Error saving image file');
//         } else {
//           resolve(filePath);
//         }
//       });
//     }
//   });
// };

// // Function to extract features using MobileNet
// const extractFeatures = async (imagePath) => {
//   const image = await tensorflow.node.decodeImage(fs.readFileSync(imagePath));
//   const model = await mobilenet.load();
//   const predictions = await model.infer(image, 'conv_preds');  // Extracts the features from the image
//   return predictions.flatten().arraySync();  // Flatten the tensor into an array for comparison
// };

// // Hamming distance function
// const hammingDistance = (hash1, hash2) => {
//   let distance = 0;
//   for (let i = 0; i < hash1.length; i++) {
//     if (hash1[i] !== hash2[i]) {
//       distance++;
//     }
//   }
//   return distance;
// };

// // Upload endpoint (base64 to image)
// app.post('/upload', async (req, res) => {
//   const { imageBase64 } = req.body;

//   if (!imageBase64) {
//     return res.status(400).json({ message: 'No image data provided' });
//   }

//   try {
//     const filePath = await saveBase64Image(imageBase64);

//     // Extract features using MobileNet
//     const imageFeatures = await extractFeatures(filePath);

//     // Store image features in the database (in addition to the filename)
//     const query = `
//       INSERT INTO ZeeImages (filename, features)
//       VALUES (@filename, @features)
//     `;
//     const request = new mssql.Request();
//     request.input('filename', mssql.NVarChar, path.basename(filePath));
//     request.input('features', mssql.VarBinary, Buffer.from(imageFeatures));

//     await request.query(query);

//     res.json({
//       message: 'Image uploaded and features saved successfully',
//       filename: path.basename(filePath),
//     });
//   } catch (err) {
//     console.error('Error processing image:', err);
//     res.status(500).json({ message: 'Error processing image' });
//   }
// });

// // Search endpoint to find similar images
// app.post('/search', async (req, res) => {
//   const { imageBase64 } = req.body;

//   if (!imageBase64) {
//     return res.status(400).json({ message: 'No image data provided' });
//   }

//   try {
//     // Save the uploaded image and generate its features
//     const uploadedImagePath = await saveBase64Image(imageBase64);
//     const uploadedFeatures = await extractFeatures(uploadedImagePath);

//     // Fetch all the images and their features from the database
//     const query = 'SELECT filename, features FROM ZeeImages';
//     const request = new mssql.Request();
//     const result = await request.query(query);

//     // Compare the uploaded image's features with the stored image features
//     const similarityThreshold = 0.8;  // Adjust similarity threshold
//     const similarImages = [];

//     result.recordset.forEach((image) => {
//       const storedFeatures = Buffer.from(image.features);
//       const similarity = compareFeatures(uploadedFeatures, storedFeatures);

//       if (similarity >= similarityThreshold) {
//         similarImages.push({
//           filename: image.filename,
//           similarity,
//         });
//       }
//     });

//     // Sort images by similarity score (highest first)
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

// // Function to compare features (using cosine similarity, for example)
// const compareFeatures = (features1, features2) => {
//   const dotProduct = features1.reduce((sum, value, index) => sum + value * features2[index], 0);
//   const magnitude1 = Math.sqrt(features1.reduce((sum, value) => sum + value ** 2, 0));
//   const magnitude2 = Math.sqrt(features2.reduce((sum, value) => sum + value ** 2, 0));
//   return dotProduct / (magnitude1 * magnitude2);
// };

// // Start the server
// app.listen(port, () => {
//   console.log(`Server running on http://localhost:${port}`);
// });
