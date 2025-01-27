const express = require('express')
const { createServer } = require('http')
const { Server } = require('socket.io')

const app = express()
const server = createServer(app)

const io = new Server(server, {
    // serveClient: true,  // Opção que, por padrão, costuma vir como true na v4
    cors: {
        origin: '*'
    }
})

io.on('connection', (socket) => {
    console.log('Cliente conectado!')
})

server.listen(3000, () => {
    console.log('Servidor rodando em http://localhost:3000')
})

token.replace('Bearer ', '')