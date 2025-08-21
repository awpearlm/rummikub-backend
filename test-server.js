const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Test server is running',
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 3000
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString() 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🧪 Test server running on port ${PORT}`);
});
