const jwt = require('jsonwebtoken');
require('dotenv').config();

const token = jwt.sign(
  { id: '123', role: 'superAdmin' },
  process.env.JWT_SECRET || 'secreto_jwt_muy_seguro_12345',
  { expiresIn: '1h' }
);

fetch('http://localhost:8080/api/cities', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => {
  console.log("=== LISTA DE CIUDADES ===");
  if (data.data) {
    data.data.forEach(c => {
      console.log(`ID: ${c._id} | Code: ${c.code} | Nombre: ${c.name}`);
    });
  } else {
    console.log(data);
  }
})
.catch(err => console.error("Error fetching cities:", err));
