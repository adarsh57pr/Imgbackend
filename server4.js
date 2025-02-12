// const express = require('express');
// const multer = require('multer');
// const fs = require('fs');
// const path = require('path');
// const mssql = require('mssql');
// require('dotenv').config();
// const tf = require('@tensorflow/tfjs-node');

// const app = express();
// const port = 5000;

// // Set up multer to handle image uploads
// const storage = multer.memoryStorage();
// const upload = multer({ storage });

// // Initialize the SQL Server connection pool
// const poolPromise = mssql.connect({
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     server: process.env.DB_SERVER,
//     database: process.env.DB_BASE,
//     options: {
//       encrypt: true,
//       trustServerCertificate: true,
//     }
// });

// // Load TensorFlow.js model (for image comparison)
// let model;

// const loadModel = async () => {
//   model = await tf.loadGraphModel('file://path/to/your/model.json');  // Load your pre-trained model
// };

// loadModel();

// // POST endpoint to handle the uploaded image
// app.post('/upload', upload.single('image'), async (req, res) => {
//   const image = req.file.buffer;  // Get image buffer

//   // Process image using TensorFlow.js model for feature extraction
//   const tensor = tf.node.decodeImage(image);
//   const features = model.predict(tensor.expandDims(0)); // Extract features (you can adjust this depending on your model)

//   // Get the feature vector as a plain array
//   const featureArray = features.arraySync()[0];

//   // Query database for objects and find similar ones
//   const pool = await poolPromise;
//   const result = await pool.request().query('SELECT * FROM objects'); // Replace with your table and query

//   let mostSimilar = null;
//   let maxSimilarity = -1;

//   result.recordset.forEach((obj) => {
//     const dbFeatures = JSON.parse(obj.features); // Assuming you stored feature vectors in the DB
//     const similarity = cosineSimilarity(featureArray, dbFeatures); // Function to calculate similarity
//     if (similarity > maxSimilarity) {
//       maxSimilarity = similarity;
//       mostSimilar = obj;
//     }
//   });

//   res.json({ mostSimilar });
// });

// // Function to calculate cosine similarity
// const cosineSimilarity = (vec1, vec2) => {
//   const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
//   const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val ** 2, 0));
//   const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val ** 2, 0));
//   return dotProduct / (magnitude1 * magnitude2);
// };

// app.listen(port, () => {
//   console.log(`Server running at http://localhost:${port}`);
// });
