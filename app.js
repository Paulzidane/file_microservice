const express = require('express');
const multer = require('multer');
const mysql = require('mysql');
const path = require('path');
const fs = require('fs');
const pdf = require('html-pdf');

const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');


const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(express.json());


app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Créer une connexion à la base de données MySQL
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: ''
});

// Créer la base de données si elle n'existe pas
connection.query('CREATE DATABASE IF NOT EXISTS fileMicroservise', (err, result) => {
  if (err) throw err;
  console.log('Base de données créée avec succès !');

  // Utiliser la base de données nouvellement créée
  connection.query('USE fileMicroservise', (err, result) => {
    if (err) throw err;

    // Créer la table "projects"
    connection.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        date DATETIME NOT NULL,
        file_path VARCHAR(255) NOT NULL
      )
    `, (err, result) => {
      if (err) throw err;
      console.log('Table "projects" créée avec succès !');

      // Fermer la connexion à la base de données
     
    });
  });
});

// Route pour créer un nouveau chantier
app.post('/projects', (req, res) => {
  try{
    const { name, modules, tasks, materials } = req.body;
  const projectDate = new Date();

  // Création du contenu HTML du document
  const html = `
  <style>
    body {
      margin: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid blue;
    }
    th, td {
      padding: 8px;
      text-align: left;
      border-bottom: 1px solid blue;
    }
    th {
      background-color: #f2f2f2;
    }
  </style>
  <h1 style="text-align: center; color: blue;">${name}</h1>
  <h2>Modules</h2>
  <ul>
    ${modules.map(module => `<li>${module}</li>`).join('')}
  </ul>
  <h2 style="text-align: center; color: blue;">Tâches</h2>
  <table>
    <thead>
      <tr>
        <th>Nom</th>
        <th>Durée</th>
      </tr>
    </thead>
    <tbody>
      ${tasks.map(task => `
        <tr>
          <td>${task.name}</td>
          <td>${task.duration}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <h2 style="text-align: center; color: blue;">Matériaux</h2>
  <table>
    <thead>
      <tr>
        <th>Nom</th>
        <th>Description</th>
        <th>Quantité</th>
        <th>Prix Unitaire</th>
        <th>Prix Total</th>
      </tr>
    </thead>
    <tbody>
      ${materials.map(material => `
        <tr>
          <td>${material.name}</td>
          <td>${material.description}</td>
          <td>${material.quantity}</td>
          <td>${material.unitPrice}</td>
          <td>${material.totalPrice}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
`;


  // Génération du document PDF
  const documentPath = `uploads/${name}_${projectDate.toISOString().slice(0, 10)}.pdf`;
  pdf.create(html, {}).toFile(documentPath, (err, res) => {
    if (err) throw err;

    // Enregistrement des informations du chantier dans la base de données
    const sql = 'INSERT INTO projects (name, date, file_path) VALUES (?, ?, ?)';
    connection.query(sql, [name, projectDate, documentPath], (err, result) => {
        if (err) {
          console.error(err);
          res.status(500).send('Erreur lors de la création du projet');
        } else {
          console.log('Chantier créé et enregistré avec succès !');
        }
      });
  });

  }catch (error) {
    console.error(error);
    res.status(500).send('Erreur lors de la création du projet');
  }
}
);

// Route pour récupérer un chantier par sa date
app.get('/projects/:date', (req, res) => {
  const projectDate = new Date(req.params.date);
  const sql = 'SELECT name, file_path FROM projects WHERE date = ?';
  connection.query(sql, [projectDate], (err, result) => {
    if (err) throw err;
    if (result.length === 0) {
      res.status(404).send('Aucun chantier trouvé pour cette date');
    } else {
      const { name, file_path } = result[0];
      res.download(file_path, `${name}.pdf`);
    }
  });
});

app.listen(4000, () => {
  console.log('Server is running on port 4000');
});
