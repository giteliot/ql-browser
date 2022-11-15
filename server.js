// Dependencies
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const app = express();
const server = http.Server(app);

app.use('/', express.static(__dirname + '/game'));// Routing

app.get('/', function(request, response) {
  response.sendFile(path.join(__dirname, '/index.html'));
});

// Starts the server.
server.listen(5001, function() {
  console.log('Starting server on port 5000');
});