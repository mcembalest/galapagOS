const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir, { extensions: ['html'] }));

app.get('/health', (req, res) => res.json({ status: 'OK' }));

app.listen(4000, () => {
    console.log('galapagOS Home running at http://localhost:4000');
});