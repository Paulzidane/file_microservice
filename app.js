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

// Connexion à la base de données MySQL
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: ''
});

// Création de la base de données et de la table "projects" si elles n'existent pas
connection.query('CREATE DATABASE IF NOT EXISTS fileMicroservise', (err, result) => {
  if (err) throw err;
  console.log('Base de données créée avec succès !');

  connection.query('USE fileMicroservise', (err, result) => {
    if (err) throw err;

    connection.query(`
       CREATE TABLE IF NOT EXISTS projectsV (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description VARCHAR(255) NOT NULL, 
        type ENUM('grand', 'moyen', 'petit') NOT NULL,
        date DATETIME NOT NULL,
        file_path VARCHAR(255) NOT NULL
      )
    `, (err, result) => {
      if (err) throw err;
      console.log('Table "projectsV" créée avec succès !');
    });
  });
});

// Route pour créer un nouveau chantier
app.post('/projects', (req, res) => {
  try {
    const { name, description, type, modules, subModules, steps, tasks, materials } = req.body;
    const projectDate = new Date();

    // Génération du contenu HTML en fonction du type de chantier
    let html;
    if (type === 'grand') {
      html = generateGrandProjectHtml(name, modules, subModules, steps, tasks, materials);
    } else if (type === 'moyen') {
      html = generateMoyenProjectHtml(name, subModules, steps, tasks, materials);
    } else if (type === 'petit') {
      html = generatePetitProjectHtml(name, steps, tasks, materials);
    }

    // Génération du document PDF
    const documentPath = `uploads/${name}_${projectDate.toISOString().slice(0, 10)}.pdf`;
    pdf.create(html, {}).toFile(documentPath, (err, pdfRes) => {
      if (err) throw err;

      // Enregistrement des informations du chantier dans la base de données
      const sql = 'INSERT INTO projectsV (name,description,type,date,file_path) VALUES (?, ?, ?, ?, ?)';
      connection.query(sql, [name,description,type,projectDate,documentPath], (err, result) => {
        if (err) {
          console.error(err);
          res.status(500).send('Erreur lors de la création du projet');
        } else {
          console.log('Chantier créé et enregistré avec succès !');
          res.status(200).send('Chantier créé avec succès !');
        }
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erreur lors de la création du projet');
  }
});

// Route pour récupérer un chantier par son nom et sa date
app.get('/projects/:name/:date', (req, res) => {
  const projectName = req.params.name;
  const projectDate = req.params.date; // Utiliser uniquement la date sans l'heure

  const sql = 'SELECT file_path FROM projectsV WHERE name = ? AND DATE(date) = ?';
  connection.query(sql, [projectName, projectDate], (err, result) => {
    if (err) throw err;
    if (result.length === 0) {
      res.status(404).send('Aucun chantier trouvé avec ce nom et cette date');
    } else {
      const { file_path } = result[0];
      res.download(file_path, `${projectName}.pdf`);
    }
  });
});


/* app.get('/projects/:date', (req, res) => {
  const projectDate = new Date(req.params.date);
  const sql = 'SELECT name, file_path FROM projectsV WHERE date = ?';
  connection.query(sql, [projectDate], (err, result) => {
    if (err) throw err;
    if (result.length === 0) {
      res.status(404).send('Aucun chantier trouvé pour cette date');
    } else {
      const { name, file_path } = result[0];
      res.download(file_path, `${name}.pdf`);
    }
  });
}); */

function generateGrandProjectHtml(name, modules, subModules, steps, tasks, materials) {
  return `
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
    ${modules.map(module => `<li>${module.name}</li>`).join('')}
  </ul>
  <h2 style="text-align: center; color: blue;">Sous-Modules</h2>
  <table>
    <thead>
      <tr>
        <th>Nom</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      ${subModules.map(subModule => `
        <tr>
          <td>${subModule.name}</td>
          <td>${subModule.description}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <h2 style="text-align: center; color: blue;">Étapes</h2>
  <table>
    <thead>
      <tr>
        <th>Nom</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      ${steps.map(step => `
        <tr>
          <td>${step.name}</td>
          <td>${step.description}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <h2 style="text-align: center; color: blue;">Tâches</h2>
  <table>
    <thead>
      <tr>
        <th>Nom</th>
        <th>Début</th>
        <th>Fin</th>
      </tr>
    </thead>
    <tbody>
      ${tasks.map(task => `
        <tr>
          <td>${task.name}</td>
          <td>${task.startDate}</td>
          <td>${task.endDate}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <h2 style="text-align: center; color: blue;">Matériaux</h2>
  <table>
    <thead>
      <tr>
        <th>Nom</th>
        <th>Quantité</th>
        <th>Prix Unitaire</th>
        <th>Prix Total</th>
      </tr>
    </thead>
    <tbody>
      ${materials.map(material => `
        <tr>
          <td>${material.name}</td>
          <td>${material.quantity}</td>
          <td>${material.unitPrice}</td>
          <td>${material.totalPrice}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  `;
}

function generateMoyenProjectHtml(name, subModules, steps, tasks, materials) {
  return `
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
  <h2 style="text-align: center; color: blue;">Sous-Modules</h2>
  <table>
    <thead>
      <tr>
        <th>Nom</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      ${subModules.map(subModule => `
        <tr>
          <td>${subModule.name}</td>
          <td>${subModule.description}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <h2 style="text-align: center; color: blue;">Étapes</h2>
  <table>
    <thead>
      <tr>
        <th>Nom</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      ${steps.map(step => `
        <tr>
          <td>${step.name}</td>
          <td>${step.description}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <h2 style="text-align: center; color: blue;">Tâches</h2>
  <table>
    <thead>
      <tr>
        <th>Nom</th>
        <th>Début</th>
        <th>Fin</th>
      </tr>
    </thead>
    <tbody>
      ${tasks.map(task => `
        <tr>
          <td>${task.name}</td>
          <td>${task.startDate}</td>
          <td>${task.endDate}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <h2 style="text-align: center; color: blue;">Matériaux</h2>
  <table>
    <thead>
      <tr>
        <th>Nom</th>
        <th>Quantité Veille</th>
        <th>Quantité Actuelle</th>
        <th>Prix Unitaire</th>
        <th>Prix Total</th>
      </tr>
    </thead>
    <tbody>
      ${materials.map(material => `
        <tr>
          <td>${material.name}</td>
          <td>${material.quantityPrevious}</td>
          <td>${material.quantityCurrent}</td>
          <td>${material.unitPrice}</td>
          <td>${material.totalPrice}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  `;
}


function generatePetitProjectHtml(name, steps, tasks, materials) {
  return `
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
  <h2 style="text-align: center; color: blue;">Étapes</h2>
  <table>
    <thead>
      <tr>
        <th>Nom</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      ${steps.map(step => `
        <tr>
          <td>${step.name}</td>
          <td>${step.description}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <h2 style="text-align: center; color: blue;">Tâches</h2>
  <table>
    <thead>
      <tr>
        <th>Nom</th>
        <th>Début</th>
        <th>Fin</th>
      </tr>
    </thead>
    <tbody>
      ${tasks.map(task => `
        <tr>
          <td>${task.name}</td>
          <td>${task.startDate}</td>
          <td>${task.endDate}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <h2 style="text-align: center; color: blue;">Matériaux</h2>
  <table>
    <thead>
      <tr>
        <th>Nom</th>
        <th>Quantité</th>
        <th>Prix Unitaire</th>
        <th>Prix Total</th>
      </tr>
    </thead>
    <tbody>
      ${materials.map(material => `
        <tr>
          <td>${material.name}</td>
          <td>${material.quantity}</td>
          <td>${material.unitPrice}</td>
          <td>${material.totalPrice}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  `;
}



app.listen(4000, () => {
  console.log('Le serveur est en cours d\'exécution sur le port 4000');
});
